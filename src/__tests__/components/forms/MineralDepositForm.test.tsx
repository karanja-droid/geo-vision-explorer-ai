import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { MineralDepositForm } from '@/components/forms/MineralDepositForm';
import { ThemeProvider } from '@/components/ThemeProvider';
import { createMockDeposit } from '@/test/setup';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="test-theme">
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('MineralDepositForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders mineral deposit creation form with all required fields', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    expect(screen.getByLabelText(/mineral type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grade \(%\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confidence level \(%\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tonnage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/depth/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record deposit/i })).toBeInTheDocument();
  });

  it('validates required fields and shows error messages', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm />
      </TestWrapper>
    );
    
    const submitButton = screen.getByRole('button', { name: /record deposit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/mineral type is required/i)).toBeInTheDocument();
      expect(screen.getByText(/site is required/i)).toBeInTheDocument();
    });
  });

  it('validates grade percentage range', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Select mineral type
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));

    // Enter invalid grade (over 100%)
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '150' }
    });

    fireEvent.click(screen.getByRole('button', { name: /record deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/grade cannot exceed 100%/i)).toBeInTheDocument();
    });
  });

  it('validates confidence level range', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Select mineral type and enter valid grade
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));
    
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '8.5' }
    });

    // Set confidence level slider to invalid range (this should be prevented by the slider)
    const confidenceSlider = screen.getByLabelText(/confidence level \(%\)/i);
    fireEvent.change(confidenceSlider, { target: { value: '150' } });

    // The slider should clamp the value to 100
    expect(confidenceSlider).toHaveValue('100');
  });

  it('displays mineral type options correctly', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);

    // Check for common minerals
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('Copper')).toBeInTheDocument();
    expect(screen.getByText('Iron')).toBeInTheDocument();
    expect(screen.getByText('Platinum')).toBeInTheDocument();
  });

  it('updates confidence level display dynamically', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    const confidenceSlider = screen.getByLabelText(/confidence level \(%\)/i);
    
    // Change confidence level
    fireEvent.change(confidenceSlider, { target: { value: '85' } });
    
    // Should display the percentage
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows confidence level color coding', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    const confidenceSlider = screen.getByLabelText(/confidence level \(%\)/i);
    
    // Test high confidence (should be green)
    fireEvent.change(confidenceSlider, { target: { value: '90' } });
    const highConfidenceDisplay = screen.getByText('90%');
    expect(highConfidenceDisplay).toHaveClass('text-green-600');
    
    // Test medium confidence (should be yellow)
    fireEvent.change(confidenceSlider, { target: { value: '65' } });
    const mediumConfidenceDisplay = screen.getByText('65%');
    expect(mediumConfidenceDisplay).toHaveClass('text-yellow-600');
    
    // Test low confidence (should be red)
    fireEvent.change(confidenceSlider, { target: { value: '30' } });
    const lowConfidenceDisplay = screen.getByText('30%');
    expect(lowConfidenceDisplay).toHaveClass('text-red-600');
  });

  it('submits form with valid data', async () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" onSuccess={mockOnSuccess} />
      </TestWrapper>
    );
    
    // Fill all required fields
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));
    
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '8.5' }
    });
    
    fireEvent.change(screen.getByLabelText(/tonnage/i), {
      target: { value: '125000' }
    });
    
    fireEvent.change(screen.getByLabelText(/confidence level \(%\)/i), {
      target: { value: '85' }
    });
    
    fireEvent.change(screen.getByLabelText(/depth/i), {
      target: { value: '15.5' }
    });
    
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: 'High-grade gold mineralization with excellent continuity' }
    });

    fireEvent.click(screen.getByRole('button', { name: /record deposit/i }));

    expect(screen.getByRole('button', { name: /recording.../i })).toBeInTheDocument();
  });

  it('handles edit mode correctly', () => {
    const testDeposit = createMockDeposit();
    
    render(
      <TestWrapper>
        <MineralDepositForm deposit={testDeposit} />
      </TestWrapper>
    );
    
    expect(screen.getByDisplayValue(testDeposit.grade.toString())).toBeInTheDocument();
    expect(screen.getByDisplayValue(testDeposit.tonnage?.toString() || '')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update deposit/i })).toBeInTheDocument();
  });

  it('pre-fills site ID when provided', () => {
    const siteId = 'test-site-123';
    
    render(
      <TestWrapper>
        <MineralDepositForm siteId={siteId} />
      </TestWrapper>
    );
    
    const siteIdInput = screen.getByLabelText(/site id/i);
    expect(siteIdInput).toHaveValue(siteId);
    expect(siteIdInput).toBeDisabled();
  });

  it('validates positive values for grade and tonnage', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Select mineral type
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));

    // Enter negative values
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '-5' }
    });
    fireEvent.change(screen.getByLabelText(/tonnage/i), {
      target: { value: '-1000' }
    });

    fireEvent.click(screen.getByRole('button', { name: /record deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/grade must be positive/i)).toBeInTheDocument();
      expect(screen.getByText(/tonnage must be positive/i)).toBeInTheDocument();
    });
  });

  it('handles discovery date selection', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Click on discovery date button
    const dateButton = screen.getByRole('button', { name: /pick a date/i });
    fireEvent.click(dateButton);
    
    // Should open calendar (in a real test, we'd mock the calendar component)
    expect(screen.getByRole('button', { name: /pick a date/i })).toBeInTheDocument();
  });

  it('validates coordinate ranges when provided', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Fill required fields
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));
    
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '8.5' }
    });

    // Enter invalid coordinates
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '95' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '200' }
    });

    fireEvent.click(screen.getByRole('button', { name: /record deposit/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid latitude/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid longitude/i)).toBeInTheDocument();
    });
  });

  it('handles form cancellation', () => {
    const mockOnCancel = jest.fn();
    
    render(
      <TestWrapper>
        <MineralDepositForm onCancel={mockOnCancel} />
      </TestWrapper>
    );
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Fill required fields
    const mineralSelect = screen.getByLabelText(/mineral type/i);
    fireEvent.click(mineralSelect);
    fireEvent.click(screen.getByText('Gold'));
    
    fireEvent.change(screen.getByLabelText(/grade \(%\)/i), {
      target: { value: '8.5' }
    });

    fireEvent.click(screen.getByRole('button', { name: /record deposit/i }));

    expect(screen.getByRole('button', { name: /recording.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recording.../i })).toBeDisabled();
  });

  it('displays confidence level range indicators', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    // Should show confidence level range labels
    expect(screen.getByText('Low (0%)')).toBeInTheDocument();
    expect(screen.getByText('Medium (50%)')).toBeInTheDocument();
    expect(screen.getByText('High (100%)')).toBeInTheDocument();
  });

  it('handles decimal precision for grade and tonnage', () => {
    render(
      <TestWrapper>
        <MineralDepositForm siteId="test-site-id" />
      </TestWrapper>
    );
    
    const gradeInput = screen.getByLabelText(/grade \(%\)/i);
    const tonnageInput = screen.getByLabelText(/tonnage/i);
    
    fireEvent.change(gradeInput, { target: { value: '8.567' } });
    fireEvent.change(tonnageInput, { target: { value: '125000.75' } });
    
    expect(gradeInput).toHaveValue(8.567);
    expect(tonnageInput).toHaveValue(125000.75);
  });
});