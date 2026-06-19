import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api';
import type { Comment } from '../src/types';
import { Widget } from '../src/Widget';

function makeApi(initial: Comment[] = []): Api {
  return {
    list: vi.fn(async () => initial),
    create: vi.fn(async (input) => ({
      id: 'generated-id',
      created_at: new Date().toISOString(),
      replies: [],
      ...input,
    })),
    reply: vi.fn(async (_id, input) => ({
      id: 'reply-id',
      created_at: new Date().toISOString(),
      ...input,
    })),
    remove: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Widget', () => {
  it('renders the floating button and loads comments into a badge', async () => {
    const api = makeApi([
      { id: 'a', url: 'u', x: 10, y: 10, author: 'Kim', text: 'hi', created_at: new Date().toISOString(), replies: [] },
    ]);
    const { container } = render(<Widget api={api} />);

    expect(api.list).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Give feedback')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('.fw-badge')?.textContent).toBe('1'));
  });

  it('enters placing mode and shows the hint', () => {
    render(<Widget api={makeApi()} />);
    fireEvent.click(screen.getByLabelText('Give feedback'));
    expect(screen.getByText(/Click anywhere to leave feedback/)).toBeTruthy();
  });

  it('places a pin and submits a comment through the api', async () => {
    const api = makeApi();
    const { container } = render(<Widget api={api} />);

    fireEvent.click(screen.getByLabelText('Give feedback'));
    const catcher = container.querySelector('.fw-catcher')!;
    fireEvent.click(catcher, { clientX: 100, clientY: 200 });

    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Kim' } });
    fireEvent.input(screen.getByPlaceholderText('Your feedback …'), { target: { value: 'Looks off' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect((api.create as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      author: 'Kim',
      text: 'Looks off',
    });
    // Author is remembered for next time.
    expect(localStorage.getItem('pindrop:author')).toBe('Kim');
  });

  it('disables submit until both fields are filled', () => {
    render(<Widget api={makeApi()} />);
    fireEvent.click(screen.getByLabelText('Give feedback'));
    fireEvent.click(document.querySelector('.fw-catcher')!, { clientX: 10, clientY: 10 });
    const submit = screen.getByText('Send') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('submits on Enter, but Shift+Enter does not', async () => {
    const api = makeApi();
    const { container } = render(<Widget api={api} />);
    fireEvent.click(screen.getByLabelText('Give feedback'));
    fireEvent.click(container.querySelector('.fw-catcher')!, { clientX: 30, clientY: 30 });

    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Kim' } });
    const textarea = screen.getByPlaceholderText('Your feedback …');
    fireEvent.input(textarea, { target: { value: 'Ship it' } });

    // Shift+Enter should not submit (newline).
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(api.create).not.toHaveBeenCalled();

    // Plain Enter submits.
    fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect((api.create as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      author: 'Kim',
      text: 'Ship it',
    });
  });

  it('replies to a comment through a thread composer', async () => {
    const api = makeApi([
      { id: 'a', url: 'u', x: 10, y: 10, author: 'Kim', text: 'hi', created_at: new Date().toISOString(), replies: [] },
    ]);
    const { container } = render(<Widget api={api} />);

    await waitFor(() => expect(container.querySelector('.fw-pin-marker')).toBeTruthy());
    fireEvent.click(container.querySelector('.fw-pin-marker')!);

    // Open the reply composer.
    fireEvent.click(screen.getByText(/^Reply/));
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Sam' } });
    fireEvent.input(screen.getByPlaceholderText('Write a reply …'), { target: { value: 'On it' } });
    fireEvent.click(screen.getByText('Reply'));

    await waitFor(() => expect(api.reply).toHaveBeenCalledOnce());
    expect((api.reply as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      'a',
      { author: 'Sam', text: 'On it' },
    ]);
    // The new reply is rendered in the thread.
    await waitFor(() => expect(screen.getByText('On it')).toBeTruthy());
  });

  it('closes the open comment card on an outside click', async () => {
    const api = makeApi([
      { id: 'a', url: 'u', x: 10, y: 10, author: 'Kim', text: 'hi', created_at: new Date().toISOString(), replies: [] },
    ]);
    const { container } = render(<Widget api={api} />);

    await waitFor(() => expect(container.querySelector('.fw-pin-marker')).toBeTruthy());
    fireEvent.click(container.querySelector('.fw-pin-marker')!);
    expect(container.querySelector('.fw-card')).toBeTruthy();

    // Click inside the card: stays open.
    fireEvent.mouseDown(container.querySelector('.fw-card')!);
    expect(container.querySelector('.fw-card')).toBeTruthy();

    // Click on empty space: closes.
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(container.querySelector('.fw-card')).toBeNull());
  });

  it('closes the open comment card via the close button', async () => {
    const api = makeApi([
      { id: 'a', url: 'u', x: 10, y: 10, author: 'Kim', text: 'hi', created_at: new Date().toISOString(), replies: [] },
    ]);
    const { container } = render(<Widget api={api} />);

    await waitFor(() => expect(container.querySelector('.fw-pin-marker')).toBeTruthy());
    const marker = container.querySelector('.fw-pin-marker')!;
    fireEvent.click(marker);
    // Hovering also keeps it open — close must override both states.
    fireEvent.mouseEnter(marker);
    expect(container.querySelector('.fw-card')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(container.querySelector('.fw-card')).toBeNull());
  });

  it('keeps focus in the name field while typing the name (regression)', () => {
    render(<Widget api={makeApi()} />);
    fireEvent.click(screen.getByLabelText('Give feedback'));
    fireEvent.click(document.querySelector('.fw-catcher')!, { clientX: 10, clientY: 10 });

    const name = screen.getByPlaceholderText('Your name') as HTMLInputElement;
    name.focus();
    fireEvent.input(name, { target: { value: 'K' } });

    // Focus must NOT jump to the textarea after the first keystroke.
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText('Your feedback …'));
  });
});
