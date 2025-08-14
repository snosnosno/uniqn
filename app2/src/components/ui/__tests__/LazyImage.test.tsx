import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LazyImage, { ImageGallery } from '../LazyImage';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
window.IntersectionObserver = mockIntersectionObserver as any;

// Mock Image constructor
const mockImage = {
  onload: null as any,
  onerror: null as any,
  src: '',
};
(global as any).Image = jest.fn(() => mockImage);

describe('LazyImage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImage.onload = null;
    mockImage.onerror = null;
    mockImage.src = '';
  });

  describe('Rendering', () => {
    it('should render with basic props', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );
      
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('alt', 'Test Image');
    });

    it('should render with placeholder initially', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          placeholder="placeholder.jpg"
        />
      );
      
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'placeholder.jpg');
    });

    it('should apply custom className', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          className="custom-class"
        />
      );
      
      const container = screen.getByRole('img', { hidden: true }).parentElement;
      expect(container).toHaveClass('custom-class');
    });

    it('should apply width and height styles', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          width={200}
          height={150}
        />
      );
      
      const container = screen.getByRole('img', { hidden: true }).parentElement;
      expect(container).toHaveStyle({ width: '200px', height: '150px' });
    });

    it('should render skeleton loader initially', () => {
      const { container } = render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );
      
      const skeleton = container.querySelector('.absolute.inset-0');
      expect(skeleton).toBeInTheDocument();
    });

    it('should apply loading and decoding attributes', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          loading="eager"
          decoding="sync"
        />
      );
      
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('loading', 'eager');
      expect(img).toHaveAttribute('decoding', 'sync');
    });

    it('should apply sizes and srcSet attributes', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          sizes="(max-width: 640px) 100vw, 640px"
          srcSet="test-image-320.jpg 320w, test-image-640.jpg 640w"
        />
      );
      
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('sizes', '(max-width: 640px) 100vw, 640px');
      expect(img).toHaveAttribute('srcset', 'test-image-320.jpg 320w, test-image-640.jpg 640w');
    });
  });

  describe('Lazy Loading', () => {
    it('should set up IntersectionObserver for lazy loading', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );
      
      expect(mockIntersectionObserver).toHaveBeenCalled();
      const observerInstance = mockIntersectionObserver.mock.results[0];
      if (observerInstance && observerInstance.value) {
        expect(observerInstance.value.observe).toHaveBeenCalled();
      }
    });

    it('should load image when intersection observer triggers', async () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      // Simulate intersection
      const [[callback]] = mockIntersectionObserver.mock.calls;
      callback([{ isIntersecting: true }]);

      // Simulate image load
      await waitFor(() => {
        expect(mockImage.src).toBe('test-image.jpg');
      });
    });

    it('should use native lazy loading when supported', () => {
      // Mock native lazy loading support
      Object.defineProperty(HTMLImageElement.prototype, 'loading', {
        configurable: true,
        value: 'lazy',
      });

      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'test-image.jpg');
    });

    it('should disconnect observer after image loads', async () => {
      const disconnectSpy = jest.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: disconnectSpy,
      });

      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      // Simulate intersection
      const [[callback]] = mockIntersectionObserver.mock.calls;
      callback([{ isIntersecting: true }]);

      // Simulate successful image load
      if (mockImage.onload) {
        mockImage.onload();
      }

      await waitFor(() => {
        expect(disconnectSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Image Loading States', () => {
    it('should call onLoad callback when image loads successfully', async () => {
      const onLoad = jest.fn();
      
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          onLoad={onLoad}
        />
      );

      // Simulate intersection
      const [[callback]] = mockIntersectionObserver.mock.calls;
      callback([{ isIntersecting: true }]);

      // Simulate successful image load
      if (mockImage.onload) {
        mockImage.onload();
      }

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalled();
      });
    });

    it('should show loaded image with fade-in animation', async () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveClass('opacity-0');

      // Simulate load event
      fireEvent.load(img);

      await waitFor(() => {
        expect(img).toHaveClass('opacity-100');
        expect(img).toHaveClass('transition-opacity', 'duration-300');
      });
    });

    it('should hide skeleton after image loads', async () => {
      const { container } = render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      const img = screen.getByRole('img', { hidden: true });
      
      // Initially skeleton should be visible
      let skeleton = container.querySelector('.absolute.inset-0');
      expect(skeleton).toBeInTheDocument();

      // Simulate load event
      fireEvent.load(img);

      await waitFor(() => {
        skeleton = container.querySelector('.absolute.inset-0');
        expect(skeleton).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should call onError callback when image fails to load', async () => {
      const onError = jest.fn();
      
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          onError={onError}
        />
      );

      // Simulate intersection
      const [[callback]] = mockIntersectionObserver.mock.calls;
      callback([{ isIntersecting: true }]);

      // Simulate image error
      if (mockImage.onerror) {
        mockImage.onerror();
      }

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should render fallback when provided and error occurs', () => {
      const fallback = <div>Error Loading Image</div>;
      
      const { rerender } = render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          fallback={fallback}
        />
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      rerender(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
          fallback={fallback}
        />
      );

      expect(screen.getByText('Error Loading Image')).toBeInTheDocument();
    });

    it('should render default error placeholder when no fallback provided', () => {
      render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      // Should render error icon
      const errorPlaceholder = screen.getByRole('img', { name: 'Test Image' });
      expect(errorPlaceholder).toBeInTheDocument();
      expect(errorPlaceholder).toHaveClass('flex', 'items-center', 'justify-center', 'bg-gray-200');
    });
  });

  describe('Cleanup', () => {
    it('should disconnect observer on unmount', () => {
      const disconnectSpy = jest.fn();
      mockIntersectionObserver.mockReturnValue({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: disconnectSpy,
      });

      const { unmount } = render(
        <LazyImage
          src="test-image.jpg"
          alt="Test Image"
        />
      );

      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });
});

describe('ImageGallery Component', () => {
  const mockImages = [
    { src: 'image1.jpg', alt: 'Image 1', thumbnail: 'thumb1.jpg' },
    { src: 'image2.jpg', alt: 'Image 2' },
    { src: 'image3.jpg', alt: 'Image 3', thumbnail: 'thumb3.jpg' },
  ];

  describe('Rendering', () => {
    it('should render all images', () => {
      render(<ImageGallery images={mockImages} />);
      
      expect(screen.getByLabelText('이미지 1 보기: Image 1')).toBeInTheDocument();
      expect(screen.getByLabelText('이미지 2 보기: Image 2')).toBeInTheDocument();
      expect(screen.getByLabelText('이미지 3 보기: Image 3')).toBeInTheDocument();
    });

    it('should apply correct column classes', () => {
      const { container, rerender } = render(
        <ImageGallery images={mockImages} columns={2} />
      );
      
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');

      rerender(<ImageGallery images={mockImages} columns={4} />);
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ImageGallery images={mockImages} className="custom-gallery" />
      );
      
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('custom-gallery');
    });

    it('should use thumbnail when provided', () => {
      render(<ImageGallery images={mockImages} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      // First image has thumbnail
      const firstImage = buttons[0]?.querySelector('img');
      if (firstImage) {
        expect(firstImage).toHaveAttribute('src', 'thumb1.jpg');
      }
    });
  });

  describe('Lightbox Interactions', () => {
    it('should open lightbox when image is clicked', () => {
      render(<ImageGallery images={mockImages} />);
      
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Lightbox should be visible
      const lightbox = screen.getByRole('dialog');
      expect(lightbox).toBeInTheDocument();
      expect(lightbox).toHaveAttribute('aria-label', '이미지 확대 보기');
    });

    it('should close lightbox when close button is clicked', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Close lightbox
      const closeButton = screen.getByLabelText('닫기');
      fireEvent.click(closeButton);
      
      // Lightbox should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close lightbox when backdrop is clicked', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Click backdrop
      const lightbox = screen.getByRole('dialog');
      fireEvent.click(lightbox);
      
      // Lightbox should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not close lightbox when image is clicked', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Click image
      const fullImage = screen.getByAltText('Image 1');
      fireEvent.click(fullImage);
      
      // Lightbox should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should navigate to previous image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox on second image
      const secondImageButton = screen.getByLabelText('이미지 2 보기: Image 2');
      fireEvent.click(secondImageButton);
      
      // Navigate to previous
      const prevButton = screen.getByLabelText('이전 이미지');
      fireEvent.click(prevButton);
      
      // Should show first image
      expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    });

    it('should navigate to next image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox on first image
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Navigate to next
      const nextButton = screen.getByLabelText('다음 이미지');
      fireEvent.click(nextButton);
      
      // Should show second image
      expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    });

    it('should hide previous button on first image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox on first image
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      // Previous button should not exist
      expect(screen.queryByLabelText('이전 이미지')).not.toBeInTheDocument();
    });

    it('should hide next button on last image', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox on last image
      const lastImageButton = screen.getByLabelText('이미지 3 보기: Image 3');
      fireEvent.click(lastImageButton);
      
      // Next button should not exist
      expect(screen.queryByLabelText('다음 이미지')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper focus states on gallery buttons', () => {
      render(<ImageGallery images={mockImages} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-primary-500');
      });
    });

    it('should have proper aria-labels for all interactive elements', () => {
      render(<ImageGallery images={mockImages} />);
      
      // Open lightbox
      const firstImageButton = screen.getByLabelText('이미지 1 보기: Image 1');
      fireEvent.click(firstImageButton);
      
      expect(screen.getByLabelText('닫기')).toBeInTheDocument();
      expect(screen.getByLabelText('다음 이미지')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '이미지 확대 보기');
    });
  });
});