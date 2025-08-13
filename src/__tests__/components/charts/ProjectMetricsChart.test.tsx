import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectMetricsChart } from '@/components/charts/ProjectMetricsChart';

const mockMetrics = {
  totalSites: 15,
  totalDeposits: 25,
  totalPredictions: 40,
  averageConfidence: 78.5,
  budgetUtilization: 65.2,
  timelineProgress: 42.8,
  mineralDistribution: [
    { name: 'Gold', value: 12, color: '#FFD700' },
    { name: 'Silver', value: 8, color: '#C0C0C0' },
    { name: 'Copper', value: 5, color: '#B87333' },
  ],
  monthlyProgress: [
    { month: 'Jan', sites: 2, deposits: 3, predictions: 5 },
    { month: 'Feb', sites: 3, deposits: 4, predictions: 7 },
    { month: 'Mar', sites: 4, deposits: 6, predictions: 9 },
  ],
  confidenceDistribution: [
    { range: '0-20%', count: 2 },
    { range: '21-40%', count: 3 },
    { range: '41-60%', count: 8 },
    { range: '61-80%', count: 10 },
    { range: '81-100%', count: 12 },
  ],
  gradeDistribution: [
    { mineral: 'Gold', averageGrade: 8.5, maxGrade: 15.2, minGrade: 2.1 },
    { mineral: 'Silver', averageGrade: 285.0, maxGrade: 450.0, minGrade: 120.0 },
    { mineral: 'Copper', averageGrade: 1.85, maxGrade: 3.2, minGrade: 0.8 },
  ],
};

describe('ProjectMetricsChart', () => {
  it('renders key metrics cards', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    expect(screen.getByText('Total Sites')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    
    expect(screen.getByText('Mineral Deposits')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    
    expect(screen.getByText('AI Predictions')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    
    expect(screen.getByText('Avg. Confidence')).toBeInTheDocument();
    expect(screen.getByText('78.5%')).toBeInTheDocument();
  });

  it('displays progress indicators', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    expect(screen.getByText('Budget Utilization')).toBeInTheDocument();
    expect(screen.getByText('65.2%')).toBeInTheDocument();
    
    expect(screen.getByText('Timeline Progress')).toBeInTheDocument();
    expect(screen.getByText('42.8%')).toBeInTheDocument();
  });

  it('renders chart tabs', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /minerals/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /confidence/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /grades/i })).toBeInTheDocument();
  });

  it('switches between chart tabs', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Should start with overview tab active
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    
    // Switch to minerals tab
    fireEvent.click(screen.getByRole('tab', { name: /minerals/i }));
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    
    // Switch to confidence tab
    fireEvent.click(screen.getByRole('tab', { name: /confidence/i }));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    
    // Switch to grades tab
    fireEvent.click(screen.getByRole('tab', { name: /grades/i }));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('displays mineral distribution data', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Switch to minerals tab
    fireEvent.click(screen.getByRole('tab', { name: /minerals/i }));
    
    expect(screen.getByText('Mineral Distribution')).toBeInTheDocument();
    expect(screen.getByText('Mineral Types')).toBeInTheDocument();
    
    // Check mineral names and counts
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Copper')).toBeInTheDocument();
  });

  it('displays confidence distribution chart', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Switch to confidence tab
    fireEvent.click(screen.getByRole('tab', { name: /confidence/i }));
    
    expect(screen.getByText('Confidence Level Distribution')).toBeInTheDocument();
  });

  it('displays grade distribution chart', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Switch to grades tab
    fireEvent.click(screen.getByRole('tab', { name: /grades/i }));
    
    expect(screen.getByText('Grade Distribution by Mineral')).toBeInTheDocument();
  });

  it('shows trend indicators on metric cards', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Should show positive trend indicators
    expect(screen.getByText('+12% this month')).toBeInTheDocument();
    expect(screen.getByText('+8% this month')).toBeInTheDocument();
    expect(screen.getByText('+25% this month')).toBeInTheDocument();
    expect(screen.getByText('+3.2% this month')).toBeInTheDocument();
  });

  it('renders progress bars with correct widths', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Budget utilization progress bar
    const budgetProgress = screen.getByText('65.2%').closest('div')?.querySelector('.bg-blue-600');
    expect(budgetProgress).toHaveStyle({ width: '65.2%' });
    
    // Timeline progress bar
    const timelineProgress = screen.getByText('42.8%').closest('div')?.querySelector('.bg-green-600');
    expect(timelineProgress).toHaveStyle({ width: '42.8%' });
  });

  it('handles empty or zero metrics gracefully', () => {
    const emptyMetrics = {
      ...mockMetrics,
      totalSites: 0,
      totalDeposits: 0,
      totalPredictions: 0,
      averageConfidence: 0,
      mineralDistribution: [],
      monthlyProgress: [],
      confidenceDistribution: [],
      gradeDistribution: [],
    };
    
    render(<ProjectMetricsChart metrics={emptyMetrics} />);
    
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ProjectMetricsChart metrics={mockMetrics} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays monthly progress data correctly', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Should be on overview tab by default
    expect(screen.getByText('Monthly Progress')).toBeInTheDocument();
    
    // Check that the area chart is rendered with the data
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('shows appropriate icons for each metric', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Icons should be present (we can't easily test the specific icons, but we can check structure)
    const metricCards = screen.getAllByRole('generic').filter(el => 
      el.className?.includes('p-3') && el.className?.includes('bg-blue-50')
    );
    
    expect(metricCards.length).toBeGreaterThan(0);
  });

  it('handles large numbers with proper formatting', () => {
    const largeMetrics = {
      ...mockMetrics,
      totalSites: 1500,
      totalDeposits: 25000,
      totalPredictions: 400000,
    };
    
    render(<ProjectMetricsChart metrics={largeMetrics} />);
    
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('25000')).toBeInTheDocument();
    expect(screen.getByText('400000')).toBeInTheDocument();
  });

  it('displays mineral distribution with badges', () => {
    render(<ProjectMetricsChart metrics={mockMetrics} />);
    
    // Switch to minerals tab
    fireEvent.click(screen.getByRole('tab', { name: /minerals/i }));
    
    // Should show badges with mineral counts
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});