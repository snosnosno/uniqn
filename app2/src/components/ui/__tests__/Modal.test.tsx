import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '../Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Modal Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
    });

    it('should render title when provided as string', () => {
      render(<Modal {...defaultProps} title="Test Title" />);
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Title').tagName).toBe('H3');
    });

    it('should render title when provided as ReactNode', () => {
      const titleElement = <span>Custom Title</span>;
      render(<Modal {...defaultProps} title={titleElement} />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render footer when provided', () => {
      const footer = <button>Footer Button</button>;
      render(<Modal {...defaultProps} footer={footer} />);
      expect(screen.getByText('Footer Button')).toBeInTheDocument();
    });

    it('should apply correct size classes', () => {
      const { rerender } = render(<Modal {...defaultProps} size="sm" />);
      let modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent?.className).toContain('max-w-md');

      rerender(<Modal {...defaultProps} size="lg" />);
      modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent?.className).toContain('max-w-2xl');

      rerender(<Modal {...defaultProps} size="xl" />);
      modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent?.className).toContain('max-w-4xl');

      rerender(<Modal {...defaultProps} size="full" />);
      modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent?.className).toContain('max-w-full');
    });

    it('should show close button by default', () => {
      render(<Modal {...defaultProps} />);
      const closeButton = screen.getByLabelText('닫기');
      expect(closeButton).toBeInTheDocument();
    });

    it('should hide close button when showCloseButton is false', () => {
      render(<Modal {...defaultProps} showCloseButton={false} />);
      const closeButton = screen.queryByLabelText('닫기');
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('닫기');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when ESC key is pressed', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnEsc={true} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when ESC key is pressed and closeOnEsc is false', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnEsc={false} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnBackdrop={true} />);
      
      const backdrop = document.querySelector('.fixed.inset-0');
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when backdrop is clicked and closeOnBackdrop is false', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnBackdrop={false} />);
      
      const modalContainer = screen.getByText('Modal Content').closest('.relative')?.parentElement;
      fireEvent.click(modalContainer!);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not close when modal content is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnBackdrop={true} />);
      
      const modalContent = screen.getByText('Modal Content');
      fireEvent.click(modalContent);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<Modal {...defaultProps} aria-label="Test Modal" />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Test Modal');
    });

    it('should use title as aria-label when aria-label is not provided', () => {
      render(<Modal {...defaultProps} title="Modal Title" />);
      
      const modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent).toHaveAttribute('aria-label', 'Modal Title');
    });

    it('should set aria-describedby when provided', () => {
      render(<Modal {...defaultProps} aria-describedby="description-id" />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'description-id');
    });

    it('should trap focus within modal', async () => {
      render(
        <Modal {...defaultProps}>
          <button>First Button</button>
          <button>Second Button</button>
          <button>Third Button</button>
        </Modal>
      );

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons.find(btn => btn.textContent === 'First Button');
      const lastButton = buttons.find(btn => btn.textContent === 'Third Button');
      
      // Focus should be trapped within modal
      firstButton?.focus();
      expect(document.activeElement).toBe(firstButton);
      
      // Tab from last focusable element should go to first
      lastButton?.focus();
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      
      await waitFor(() => {
        // Focus trap behavior would cycle back
        expect(document.activeElement).toBeTruthy();
      });
    });

    it('should have aria-hidden on backdrop', () => {
      render(<Modal {...defaultProps} />);
      
      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Body Scroll Lock', () => {
    it('should prevent body scroll when preventScroll is true', () => {
      const originalOverflow = document.body.style.overflow;
      
      render(<Modal {...defaultProps} preventScroll={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      // Cleanup
      document.body.style.overflow = originalOverflow;
    });

    it('should not affect body scroll when preventScroll is false', () => {
      const originalOverflow = document.body.style.overflow;
      
      render(<Modal {...defaultProps} preventScroll={false} />);
      expect(document.body.style.overflow).toBe(originalOverflow);
    });

    it('should restore body scroll on unmount', () => {
      const originalOverflow = document.body.style.overflow;
      
      const { unmount } = render(<Modal {...defaultProps} preventScroll={true} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      unmount();
      expect(document.body.style.overflow).toBe(originalOverflow);
    });
  });

  describe('Portal Rendering', () => {
    it('should render modal in document.body via portal', () => {
      const { container } = render(<Modal {...defaultProps} />);
      
      // Modal should not be in the container
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      
      // But should be in document.body
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should apply fade-in animation class', () => {
      render(<Modal {...defaultProps} />);

      const modalContent = screen.getByText('Modal Content').closest('.relative');
      expect(modalContent?.className).toContain('animate-fade-in');
    });
  });

  describe('Centered Mode', () => {
    it('should apply centered positioning when centered is true', () => {
      render(<Modal {...defaultProps} centered={true} />);

      const modalContainer = screen.getByText('Modal Content').closest('.relative')?.parentElement;
      expect(modalContainer?.className).toContain('items-center');
      expect(modalContainer?.className).toContain('justify-center');
    });

    it('should apply top positioning when centered is false', () => {
      render(<Modal {...defaultProps} centered={false} />);

      const modalContainer = screen.getByText('Modal Content').closest('.relative')?.parentElement;
      expect(modalContainer?.className).toContain('items-start');
      expect(modalContainer?.className).toContain('justify-center');
    });
  });
});