import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProjectForm } from '@/components/forms/ProjectForm';
import { mockProjects } from '@/utils/mockData';
import { ThemeProvider } from '@/components/ThemeProvider';

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

describe('ProjectForm', () => {
  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  it('renders project creation form with all required fields', () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('validates required fields and shows error messages', async () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    const submitButton = screen.getByRole('button', { name: /create project/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/location is required/i)).toBeInTheDocument();
    });
  });

  it('validates coordinate ranges', async () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project' }
    });
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Nevada, USA' }
    });

    // Enter invalid coordinates
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '95' } // Invalid latitude > 90
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '200' } // Invalid longitude > 180
    });

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid latitude/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid longitude/i)).toBeInTheDocument();
    });
  });

  it('validates date ranges (end date after start date)', async () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project' }
    });
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Nevada, USA' }
    });

    // Set end date before start date
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    fireEvent.change(startDateInput, { target: { value: '2024-12-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-06-01' } });

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <TestWrapper>
        <ProjectForm onSuccess={mockOnSuccess} />
      </TestWrapper>
    );
    
    // Fill all required fields with valid data
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Nevada Gold Exploration' }
    });
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Elko County, Nevada' }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Large-scale gold exploration project in the Carlin Trend' }
    });
    fireEvent.change(screen.getByLabelText(/budget/i), {
      target: { value: '15000000' }
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '40.5' }
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-116.5' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    // Note: In a real test, we'd mock the API call
    // For now, we're testing the form validation and submission flow
    expect(screen.getByRole('button', { name: /creating.../i })).toBeInTheDocument();
  });

  it('handles edit mode correctly', () => {
    const testProject = mockProjects[0];
    
    render(
      <TestWrapper>
        <ProjectForm project={testProject} />
      </TestWrapper>
    );
    
    expect(screen.getByDisplayValue(testProject.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(testProject.location)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update project/i })).toBeInTheDocument();
  });

  it('shows loading state during form submission', async () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project' }
    });
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Nevada, USA' }
    });

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(screen.getByRole('button', { name: /creating.../i })).toBeInTheDocument();
  });

  it('handles form cancellation', () => {
    const mockOnCancel = jest.fn();
    
    render(
      <TestWrapper>
        <ProjectForm onCancel={mockOnCancel} />
      </TestWrapper>
    );
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('formats budget input correctly', () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    const budgetInput = screen.getByLabelText(/budget/i);
    fireEvent.change(budgetInput, { target: { value: '1500000.50' } });
    
    expect(budgetInput).toHaveValue(1500000.50);
  });

  it('handles coordinate input with decimal precision', () => {
    render(
      <TestWrapper>
        <ProjectForm />
      </TestWrapper>
    );
    
    const latInput = screen.getByLabelText(/latitude/i);
    const lngInput = screen.getByLabelText(/longitude/i);
    
    fireEvent.change(latInput, { target: { value: '40.123456' } });
    fireEvent.change(lngInput, { target: { value: '-116.789012' } });
    
    expect(latInput).toHaveValue(40.123456);
    expect(lngInput).toHaveValue(-116.789012);
  });
});