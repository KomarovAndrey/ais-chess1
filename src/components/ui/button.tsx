import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-gold text-ink-900 shadow-glow hover:bg-gold-bright",
        secondary:
          "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        outline:
          "border border-white/15 bg-transparent text-white hover:bg-white/5",
        ghost: "text-white/80 hover:bg-white/10"
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
