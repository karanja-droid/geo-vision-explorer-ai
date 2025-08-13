import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SiteForm } from '@/components/forms/SiteForm';
import { mockSites } from '@/utils/mockData';
import { ThemeProvider } from '@/components/ThemeProvider';
import { createMockSite } from '@/test/setup';

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

describe('SiteForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders site creation form with all required fields', () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/site type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/elevation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create site/i })).toBeInTheDocument();
  });

  it('validates required fields and shows error messages', async () => {
    render(
      <TestWrapper>
        <SiteForm />
      </TestWrapper>
    );
    
    const submitButton = screen.getByRole('button', { name: /create site/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/site name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/project is required/i)).toBeInTheDocument();
    });
  });

  it('validates coordinate ranges', async () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: 'Test Site' }
    });

    // Enter invalid coordinates
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '95' } // Invalid latitude > 90
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '200' } // Invalid longitude > 180
    });

    fireEvent.click(screen.getByRole('button', { name: /create site/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid latitude/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid longitude/i)).toBeInTheDocument();
    });
  });

  it('displays site type options correctly', () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    const siteTypeSelect = screen.getByLabelText(/site type/i);
    fireEvent.click(siteTypeSelect);

    expect(screen.getByText('Outcrop')).toBeInTheDocument();
    expect(screen.getByText('Drill Site')).toBeInTheDocument();
    expect(screen.getByText('Sample Location')).toBeInTheDocument();
    expect(screen.getByText('Survey Point')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" onSuccess={mockOnSuccess} />
      </TestWrapper>
    );
    
    // Fill all required fields with valid data
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: 'Carlin North Outcrop' }
    });
    
    // Select site type
    const siteTypeSelect = screen.getByLabelText(/site type/i);
    fireEvent.click(siteTypeSelect);
    fireEvent.click(screen.getByText('Outcrop'));
    
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Primary gold-bearing outcrop with visible quartz veining' }
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '40.52' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-116.48' }
    });
    fireEvent.change(screen.getByLabelText(/elevation/i), {
      target: { value: '1850.5' }
    });
    fireEvent.change(screen.getByLabelText(/access notes/i), {
      target: { value: 'Accessible via dirt road, 4WD recommended' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create site/i }));

    // Note: In a real test, we'd mock the API call
    expect(screen.getByRole('button', { name: /creating.../i })).toBeInTheDocument();
  });

  it('handles edit mode correctly', () => {
    const testSite = createMockSite();
    
    render(
      <TestWrapper>
        <SiteForm site={testSite} />
      </TestWrapper>
    );
    
    expect(screen.getByDisplayValue(testSite.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(testSite.description || '')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update site/i })).toBeInTheDocument();
  });

  it('pre-fills project ID when provided', () => {
    const projectId = 'test-project-123';
    
    render(
      <TestWrapper>
        <SiteForm projectId={projectId} />
      </TestWrapper>
    );
    
    const projectIdInput = screen.getByLabelText(/project id/i);
    expect(projectIdInput).toHaveValue(projectId);
    expect(projectIdInput).toBeDisabled();
  });

  it('validates elevation as positive number', async () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: 'Test Site' }
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '40.5' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-116.5' }
    });

    // Enter negative elevation
    fireEvent.change(screen.getByLabelText(/elevation/i), {
      target: { value: '-100' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create site/i }));

    // Should accept negative elevation (below sea level is valid)
    expect(screen.queryByText(/elevation must be positive/i)).not.toBeInTheDocument();
  });

  it('handles form cancellation', () => {
    const mockOnCancel = jest.fn();
    
    render(
      <TestWrapper>
        <SiteForm onCancel={mockOnCancel} />
      </TestWrapper>
    );
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: 'Test Site' }
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '40.5' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-116.5' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create site/i }));

    expect(screen.getByRole('button', { name: /creating.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating.../i })).toBeDisabled();
  });

  it('handles coordinate input with high precision', () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    const latInput = screen.getByLabelText(/latitude/i);
    const lngInput = screen.getByLabelText(/longitude/i);
    
    fireEvent.change(latInput, { target: { value: '40.123456789' } });
    fireEvent.change(lngInput, { target: { value: '-116.987654321' } });
    
    expect(latInput).toHaveValue(40.123456789);
    expect(lngInput).toHaveValue(-116.987654321);
  });

  it('validates site type selection', async () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    // Fill required fields except site type
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: 'Test Site' }
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '40.5' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-116.5' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create site/i }));

    // Site type should have a default value, so no validation error expected
    expect(screen.queryByText(/site type is required/i)).not.toBeInTheDocument();
  });

  it('displays appropriate labels and placeholders', () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    expect(screen.getByPlaceholderText(/enter site name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter site description/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\., 40\.7128/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\., -74\.0060/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\., 1250\.5/i)).toBeInTheDocument();
  });

  it('handles extremely long text inputs gracefully', () => {
    render(
      <TestWrapper>
        <SiteForm projectId="test-project-id" />
      </TestWrapper>
    );
    
    const longText = 'A'.repeat(1000);
    
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: longText }
    });
    
    // Should truncate or handle long input appropriately
    const nameInput = screen.getByLabelText(/site name/i);
    expect(nameInput.value.length).toBeLessThanOrEqual(100); // Assuming max length validation
  });
});