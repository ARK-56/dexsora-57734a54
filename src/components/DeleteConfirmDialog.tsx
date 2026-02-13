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
import { Trash2, ArchiveX } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onSoftDelete: () => void;
  onPermanentDelete: () => void;
}

export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  count,
  onSoftDelete,
  onPermanentDelete,
}: DeleteConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} lead{count > 1 ? "s" : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose how you want to remove the selected lead{count > 1 ? "s" : ""}. 
            Moving to trash allows recovery later, while permanent deletion cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onSoftDelete}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            <ArchiveX className="h-4 w-4 mr-1.5" />
            Move to Trash
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onPermanentDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
