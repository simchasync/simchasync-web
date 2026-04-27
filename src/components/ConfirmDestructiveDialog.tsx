import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

export type ConfirmDestructiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Shown on the confirm button while `isPending` (e.g. i18n “Deleting…”). */
  pendingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
};

/**
 * Centered destructive confirmation (uses AlertDialog: fixed overlay + 50%/50% translated panel).
 */
export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "…",
  cancelLabel = "Cancel",
  onConfirm,
  isPending = false,
}: ConfirmDestructiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md"
      >
        <AlertDialogHeader className="text-center sm:text-center">
          <AlertDialogTitle className="flex items-center justify-center gap-2 text-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="text-balance text-center text-sm text-muted-foreground">{description}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:space-x-0">
          <AlertDialogCancel disabled={isPending} className="m-0 mt-0 w-full min-w-0 sm:mt-0 sm:w-auto">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="w-full min-w-0 bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
