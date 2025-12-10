import type { Meta, StoryObj } from '@storybook/svelte';
import DifficultyBadge from './DifficultyBadge.svelte';

const meta = {
	title: 'Components/DifficultyBadge',
	component: DifficultyBadge,
	tags: ['autodocs'],
	argTypes: {
		difficulty: {
			control: { type: 'number', min: 1, max: 7 },
			description: 'Difficulty level (1-7 dots in Rock Band)'
		},
		instrument: {
			control: 'text',
			description: 'Optional instrument name to display'
		}
	}
} satisfies Meta<DifficultyBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Easy: Story = {
	args: {
		difficulty: 1
	}
};

export const Medium: Story = {
	args: {
		difficulty: 4
	}
};

export const Hard: Story = {
	args: {
		difficulty: 7
	}
};

export const WithInstrument: Story = {
	args: {
		difficulty: 5,
		instrument: 'Guitar'
	}
};
