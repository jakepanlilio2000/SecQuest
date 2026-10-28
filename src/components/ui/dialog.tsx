"use client";

import * as React from "react";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "sq:fixed sq:inset-0 sq:z-50 sq:bg-black/50 sq:data-[state=closed]:animate-out sq:data-[state=closed]:fade-out-0 sq:data-[state=open]:animate-in sq:data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "sq:fixed sq:top-[50%] sq:left-[50%] sq:z-50 sq:grid sq:w-full sq:max-w-[calc(100%-2rem)] sq:translate-x-[-50%] sq:translate-y-[-50%] sq:gap-4 sq:rounded-lg sq:border sq:bg-background sq:p-6 sq:shadow-lg sq:duration-200 sq:outline-none sq:data-[state=closed]:animate-out sq:data-[state=closed]:fade-out-0 sq:data-[state=closed]:zoom-out-95 sq:data-[state=open]:animate-in sq:data-[state=open]:fade-in-0 sq:data-[state=open]:zoom-in-95 sq:sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="sq:absolute sq:top-4 sq:right-4 sq:rounded-xs sq:opacity-70 sq:ring-offset-background sq:transition-opacity sq:hover:opacity-100 sq:focus:ring-2 sq:focus:ring-ring sq:focus:ring-offset-2 sq:focus:outline-hidden sq:disabled:pointer-events-none sq:data-[state=open]:bg-accent sq:data-[state=open]:text-muted-foreground sq:[&_svg]:pointer-events-none sq:[&_svg]:shrink-0 sq:[&_svg:not([class*=size-])]:size-4"
          >
            <XIcon />
            <span className="sq:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sq:flex sq:flex-col sq:gap-2 sq:text-center sq:sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "sq:flex sq:flex-col-reverse sq:gap-2 sq:sm:flex-row sq:sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("sq:text-lg sq:leading-none sq:font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("sq:text-sm sq:text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
