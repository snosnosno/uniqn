import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BaseCard, { CardHeader, CardBody, CardFooter } from '../BaseCard';

describe('BaseCard Component', () => {
  describe('Rendering', () => {
    it('should render children correctly', () => {
      render(
        <BaseCard>
          <div>Test Content</div>
        </BaseCard>
      );
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should apply default variant class', () => {
      render(<BaseCard data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('shadow-sm');
    });

    it('should apply elevated variant class', () => {
      render(<BaseCard variant="elevated" data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('shadow-lg');
    });

    it('should apply bordered variant class', () => {
      render(<BaseCard variant="bordered" data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('border', 'border-gray-200');
    });

    it('should apply ghost variant class', () => {
      render(<BaseCard variant="ghost" data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('bg-transparent');
    });

    it('should apply custom className', () => {
      render(
        <BaseCard className="custom-class" data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('custom-class');
    });

    it('should apply padding classes based on padding prop', () => {
      render(<BaseCard padding="lg" data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('p-6');
    });
  });

  describe('Interactivity', () => {
    it('should handle onClick event', () => {
      const handleClick = jest.fn();
      render(
        <BaseCard onClick={handleClick} data-testid="base-card">
          <div>Clickable Card</div>
        </BaseCard>
      );

      const card = screen.getByTestId('base-card');
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply hover classes when hover prop is true', () => {
      render(<BaseCard hover data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('hover:shadow-md');
    });

    it('should apply active classes when active prop is true', () => {
      render(<BaseCard active data-testid="base-card">Content</BaseCard>);
      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('ring-2', 'ring-primary-500');
    });

    it('should apply disabled styles and prevent click when disabled', () => {
      const handleClick = jest.fn();
      render(
        <BaseCard onClick={handleClick} disabled data-testid="base-card">
          Content
        </BaseCard>
      );

      const card = screen.getByTestId('base-card');
      expect(card).toHaveClass('opacity-50', 'cursor-not-allowed');

      fireEvent.click(card);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should apply aria-label when provided', () => {
      render(
        <BaseCard aria-label="Test Card" data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveAttribute('aria-label', 'Test Card');
    });

    it('should apply aria-labelledby when provided', () => {
      render(
        <BaseCard aria-labelledby="title-id" data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveAttribute('aria-labelledby', 'title-id');
    });

    it('should apply aria-describedby when provided', () => {
      render(
        <BaseCard aria-describedby="desc-id" data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveAttribute('aria-describedby', 'desc-id');
    });

    it('should apply role when provided', () => {
      render(
        <BaseCard role="article" data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveAttribute('role', 'article');
    });

    it('should apply tabIndex when provided', () => {
      render(
        <BaseCard tabIndex={0} data-testid="base-card">Content</BaseCard>
      );
      const card = screen.getByTestId('base-card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should handle keyboard interaction when onClick is provided', () => {
      const handleClick = jest.fn();
      render(
        <BaseCard onClick={handleClick} tabIndex={0} data-testid="base-card">
          Content
        </BaseCard>
      );

      const card = screen.getByTestId('base-card');
      card.focus();

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Card Sub-components', () => {
    it('should render CardHeader correctly', () => {
      render(
        <BaseCard>
          <CardHeader>Header Content</CardHeader>
        </BaseCard>
      );
      expect(screen.getByText('Header Content')).toBeInTheDocument();
    });

    it('should render CardBody correctly', () => {
      render(
        <BaseCard>
          <CardBody>Body Content</CardBody>
        </BaseCard>
      );
      expect(screen.getByText('Body Content')).toBeInTheDocument();
    });

    it('should render CardFooter correctly', () => {
      render(
        <BaseCard>
          <CardFooter>Footer Content</CardFooter>
        </BaseCard>
      );
      expect(screen.getByText('Footer Content')).toBeInTheDocument();
    });

    it('should render all sub-components together', () => {
      render(
        <BaseCard>
          <CardHeader>Header</CardHeader>
          <CardBody>Body</CardBody>
          <CardFooter>Footer</CardFooter>
        </BaseCard>
      );

      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });

    it('should apply custom className to sub-components', () => {
      render(
        <BaseCard>
          <CardHeader className="header-class" data-testid="card-header">Header</CardHeader>
          <CardBody className="body-class" data-testid="card-body">Body</CardBody>
          <CardFooter className="footer-class" data-testid="card-footer">Footer</CardFooter>
        </BaseCard>
      );

      expect(screen.getByTestId('card-header')).toHaveClass('header-class');
      expect(screen.getByTestId('card-body')).toHaveClass('body-class');
      expect(screen.getByTestId('card-footer')).toHaveClass('footer-class');
    });
  });

  describe('Forward Ref', () => {
    it('should forward ref to the card element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <BaseCard ref={ref}>Content</BaseCard>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.textContent).toBe('Content');
    });
  });
});
