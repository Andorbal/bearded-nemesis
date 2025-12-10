import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NumberInput from './NumberInput.svelte';

describe('NumberInput', () => {
  it('renders with label and initial value', () => {
    const mockSave = vi.fn();
    render(NumberInput, {
      props: {
        value: 42,
        label: 'Test Input',
        onSave: mockSave
      }
    });

    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Test Input')).toHaveValue(42);
  });

  it('calls onSave when field loses focus', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    render(NumberInput, {
      props: {
        value: '',
        label: 'Score',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Score');
    await fireEvent.input(input, { target: { value: '150' } });
    await fireEvent.blur(input);

    expect(mockSave).toHaveBeenCalledWith(150);
  });

  it('calls onSave with null for empty value', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    render(NumberInput, {
      props: {
        value: 42,
        label: 'Score',
        onSave: mockSave
      }
    });

    const input = screen.getByLabelText('Score');
    await fireEvent.input(input, { target: { value: '' } });
    await fireEvent.blur(input);

    expect(mockSave).toHaveBeenCalledWith(null);
  });
});
