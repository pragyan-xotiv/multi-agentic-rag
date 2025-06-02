// Reexport from sonner
import { toast } from "sonner";

export { toast };

// Create a custom hook wrapper that matches the expected interface
export const useToast = () => {
  return {
    toast
  };
}; 