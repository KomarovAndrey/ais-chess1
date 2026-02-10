import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-orange-500 text-white shadow-md hover:bg-orange-600 focus-visible:ring-orange-500",
        secondary:
          "bg-blue-600 text-white shadow-md hover:bg-blue-700 focus-visible:ring-blue-500",
        outline:
          "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-300",
        ghost: "text-slate-700 hover:bg-slate-100"
      },
      size: {
        default: "min-h-[44px] px-4 py-2",
        lg: "min-h-[44px] px-6 py-3 text-base",
        sm: "px-3 py-1.5 text-xs",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

