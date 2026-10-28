"use client";

import * as React from "react";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "sq:fixed sq:inset-0 sq:z-50 sq:bg-black/50 sq:data-[state=closed]:animate-out sq:data-[state=closed]:fade-out-0 sq:data-[state=open]:animate-in sq:data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "sq:fixed sq:z-50 sq:flex sq:flex-col sq:gap-4 sq:bg-background sq:shadow-lg sq:transition sq:ease-in-out sq:data-[state=closed]:animate-out sq:data-[state=closed]:duration-300 sq:data-[state=open]:animate-in sq:data-[state=open]:duration-500",
          side === "right" &&
            "sq:inset-y-0 sq:right-0 sq:h-full sq:w-3/4 sq:border-l sq:data-[state=closed]:slide-out-to-right sq:data-[state=open]:slide-in-from-right sq:sm:max-w-sm",
          side === "left" &&
            "sq:inset-y-0 sq:left-0 sq:h-full sq:w-3/4 sq:border-r sq:data-[state=closed]:slide-out-to-left sq:data-[state=open]:slide-in-from-left sq:sm:max-w-sm",
          side === "top" &&
            "sq:inset-x-0 sq:top-0 sq:h-auto sq:border-b sq:data-[state=closed]:slide-out-to-top sq:data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "sq:inset-x-0 sq:bottom-0 sq:h-auto sq:border-t sq:data-[state=closed]:slide-out-to-bottom sq:data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="sq:absolute sq:top-4 sq:right-4 sq:rounded-xs sq:opacity-70 sq:ring-offset-background sq:transition-opacity sq:hover:opacity-100 sq:focus:ring-2 sq:focus:ring-ring sq:focus:ring-offset-2 sq:focus:outline-hidden sq:disabled:pointer-events-none sq:data-[state=open]:bg-secondary"
          >
            <XIcon className="sq:size-4" />
            <span className="sq:sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("sq:flex sq:flex-col sq:gap-1.5 sq:p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "sq:mt-auto sq:flex sq:flex-col sq:gap-2 sq:p-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("sq:font-semibold sq:text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("sq:text-sm sq:text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
