import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "sq:inline-flex sq:shrink-0 sq:items-center sq:justify-center sq:gap-2 sq:rounded-md sq:text-sm sq:font-medium sq:whitespace-nowrap sq:transition-all sq:outline-none sq:focus-visible:border-ring sq:focus-visible:ring-[3px] sq:focus-visible:ring-ring/50 sq:disabled:pointer-events-none sq:disabled:opacity-50 sq:aria-invalid:border-destructive sq:aria-invalid:ring-destructive/20 sq:dark:aria-invalid:ring-destructive/40 sq:[&_svg]:pointer-events-none sq:[&_svg]:shrink-0 sq:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default:
          "sq:bg-primary sq:text-primary-foreground sq:hover:bg-primary/90",
        destructive:
          "sq:bg-destructive sq:text-white sq:hover:bg-destructive/90 sq:focus-visible:ring-destructive/20 sq:dark:bg-destructive/60 sq:dark:focus-visible:ring-destructive/40",
        outline:
          "sq:border sq:bg-background sq:shadow-xs sq:hover:bg-accent sq:hover:text-accent-foreground sq:dark:border-input sq:dark:bg-input/30 sq:dark:hover:bg-input/50",
        secondary:
          "sq:bg-secondary sq:text-secondary-foreground sq:hover:bg-secondary/80",
        ghost:
          "sq:hover:bg-accent sq:hover:text-accent-foreground sq:dark:hover:bg-accent/50",
        link: "sq:text-primary sq:underline-offset-4 sq:hover:underline",
      },
      size: {
        default: "sq:h-9 sq:px-4 sq:py-2 sq:has-[>svg]:px-3",
        xs: "sq:h-6 sq:gap-1 sq:rounded-md sq:px-2 sq:text-xs sq:has-[>svg]:px-1.5 sq:[&_svg:not([class*=size-])]:size-3",
        sm: "sq:h-8 sq:gap-1.5 sq:rounded-md sq:px-3 sq:has-[>svg]:px-2.5",
        lg: "sq:h-10 sq:rounded-md sq:px-6 sq:has-[>svg]:px-4",
        icon: "sq:size-9",
        "icon-xs":
          "sq:size-6 sq:rounded-md sq:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "sq:size-8",
        "icon-lg": "sq:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
