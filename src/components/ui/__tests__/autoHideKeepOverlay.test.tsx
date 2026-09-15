/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import {
  Popover,
  PopoverContent,
} from '../popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../alert-dialog';

describe('auto-hide protected overlay content', () => {
  it('marks open PopoverContent in its portal', () => {
    render(
      <Popover open>
        <PopoverContent data-testid="popover-content">Popover</PopoverContent>
      </Popover>,
    );

    expect(screen.getByTestId('popover-content').getAttribute('data-auto-hide-keep')).not.toBeNull();
  });

  it('marks open DialogContent in its portal', () => {
    render(
      <Dialog open>
        <DialogContent data-testid="dialog-content">
          <DialogTitle>Dialog</DialogTitle>
          <DialogDescription>Details</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByTestId('dialog-content').getAttribute('data-auto-hide-keep')).not.toBeNull();
  });

  it('marks open AlertDialogContent in its portal', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent data-testid="alert-dialog-content">
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogDescription>Details</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByTestId('alert-dialog-content').getAttribute('data-auto-hide-keep')).not.toBeNull();
  });
});
