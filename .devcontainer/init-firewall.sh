#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Modified firewall script that allows access to local Docker services
# while still restricting external network access
#
# Allowed domains are read from:
#   - /etc/claude-firewall/allowed-domains.txt (committed to repo, baked into image)
#   - /etc/claude-firewall/allowed-domains.local.txt (volume-mounted, for personal domains)

# Function to read domains from a file (skipping comments and empty lines)
read_domains() {
    local file="$1"
    if [ -f "$file" ]; then
        grep -v '^#' "$file" | grep -v '^[[:space:]]*$' || true
    fi
}

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Read allowed domains from config files
DOMAINS_FILE="/etc/claude-firewall/allowed-domains.txt"
LOCAL_DOMAINS_FILE="/etc/claude-firewall/allowed-domains.local.txt"

# Collect all domains from both files
ALL_DOMAINS=""
if [ -f "$DOMAINS_FILE" ]; then
    echo "Reading domains from $DOMAINS_FILE..."
    ALL_DOMAINS=$(read_domains "$DOMAINS_FILE")
fi

if [ -f "$LOCAL_DOMAINS_FILE" ]; then
    echo "Reading local domains from $LOCAL_DOMAINS_FILE..."
    LOCAL_DOMAINS=$(read_domains "$LOCAL_DOMAINS_FILE")
    if [ -n "$LOCAL_DOMAINS" ]; then
        if [ -n "$ALL_DOMAINS" ]; then
            ALL_DOMAINS="$ALL_DOMAINS"$'\n'"$LOCAL_DOMAINS"
        else
            ALL_DOMAINS="$LOCAL_DOMAINS"
        fi
    fi
fi

if [ -z "$ALL_DOMAINS" ]; then
    echo "Warning: No domains found in config files"
fi

# Resolve and add allowed domains
while IFS= read -r domain; do
    [ -z "$domain" ] && continue
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "Warning: Failed to resolve $domain, skipping..."
        continue
    fi

    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "Warning: Invalid IP from DNS for $domain: $ip, skipping..."
            continue
        fi
        if ipset test allowed-domains "$ip" 2>/dev/null; then
            echo "Skipping $ip for $domain (already in set)"
        else
            echo "Adding $ip for $domain"
            ipset add allowed-domains "$ip"
        fi
    done < <(echo "$ips")
done <<< "$ALL_DOMAINS"

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# Resolve host.docker.internal for Docker Desktop connectivity
# This is needed to reach services running on the host (PostgreSQL, Solver, etc.)
HOST_DOCKER_INTERNAL_IP=$(getent hosts host.docker.internal | awk '{print $1}' || true)
if [ -n "$HOST_DOCKER_INTERNAL_IP" ]; then
    echo "host.docker.internal resolves to: $HOST_DOCKER_INTERNAL_IP"
    iptables -A INPUT -s "$HOST_DOCKER_INTERNAL_IP" -j ACCEPT
    iptables -A OUTPUT -d "$HOST_DOCKER_INTERNAL_IP" -j ACCEPT
else
    echo "Warning: host.docker.internal not resolvable, host services may not be accessible"
fi

# NEW: Allow access to Docker bridge network for inter-container communication
# This allows Claude to connect to postgres, redis, etc.
DOCKER_NETWORKS=$(ip route | grep -E "172\.(1[6-9]|2[0-9]|3[0-1])\." | awk '{print $1}' || true)
if [ -n "$DOCKER_NETWORKS" ]; then
    while read -r network; do
        echo "Allowing Docker network: $network"
        iptables -A INPUT -s "$network" -j ACCEPT
        iptables -A OUTPUT -d "$network" -j ACCEPT
    done < <(echo "$DOCKER_NETWORKS")
else
    echo "Warning: No Docker bridge networks detected"
fi

# Allow all RFC1918 private networks (for local services like GitLab)
# This is safe because we're already in a sandboxed container
echo "Allowing RFC1918 private networks for local services..."
for private_range in "10.0.0.0/8" "172.16.0.0/12" "192.168.0.0/16"; do
    echo "Allowing private network: $private_range"
    iptables -A INPUT -s "$private_range" -j ACCEPT
    iptables -A OUTPUT -d "$private_range" -j ACCEPT
done

# Set default policies to DROP first
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# First allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Then allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi

echo "Firewall setup complete with Docker service access enabled"
