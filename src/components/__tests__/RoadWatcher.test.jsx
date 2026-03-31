// src/components/__tests__/RoadWatcher.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoadWatcher from '../RoadWatcher.jsx';
import fixtureData from '../../engine/__tests__/fixtures/scenario-fixture.json';

const ALL_FRAMES = fixtureData.frames;
const ROAD = { name: 'Christopher Road', id: 'christopher_rd' };

describe('RoadWatcher', () => {
  it('renders road name as heading', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText('Christopher Road')).toBeInTheDocument();
  });

  it('shows total, inbound and outbound labels', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getAllByText(/inbound/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/outbound/i).length).toBeGreaterThan(0);
  });

  it('computes total inbound count from allFrames', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    // fixture: frame 23400 inbound=2, frame 23460 inbound=1 → total=3
    // (totals are sum of inbound per frame, not unique vehicles)
    expect(screen.getByTestId('total-inbound')).toHaveTextContent('3');
  });

  it('shows avg delay inbound', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    expect(screen.getByText(/avg delay inbound/i)).toBeInTheDocument();
  });

  it('calls onClose when × button clicked', async () => {
    const onClose = vi.fn();
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders time series bars (8 buckets)', () => {
    render(<RoadWatcher road={ROAD} allFrames={ALL_FRAMES} onClose={() => {}} />);
    // SVG bars — each bucket is a <rect>
    const bars = document.querySelectorAll('[data-testid="timeseries-bar"]');
    expect(bars.length).toBe(8);
  });

  it('shows "loading" state when allFrames is null', () => {
    render(<RoadWatcher road={ROAD} allFrames={null} onClose={() => {}} />);
    expect(screen.getByText(/simulation running/i)).toBeInTheDocument();
  });
});
