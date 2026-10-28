"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "sq:group/tabs sq:flex sq:gap-2 sq:data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "sq:group/tabs-list sq:inline-flex sq:w-fit sq:items-center sq:justify-center sq:rounded-lg sq:p-[3px] sq:text-muted-foreground sq:group-data-[orientation=horizontal]/tabs:h-9 sq:group-data-[orientation=vertical]/tabs:h-fit sq:group-data-[orientation=vertical]/tabs:flex-col sq:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "sq:bg-muted",
        line: "sq:gap-1 sq:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "sq:relative sq:inline-flex sq:h-[calc(100%-1px)] sq:flex-1 sq:items-center sq:justify-center sq:gap-1.5 sq:rounded-md sq:border sq:border-transparent sq:px-2 sq:py-1 sq:text-sm sq:font-medium sq:whitespace-nowrap sq:text-foreground/60 sq:transition-all sq:group-data-[orientation=vertical]/tabs:w-full sq:group-data-[orientation=vertical]/tabs:justify-start sq:hover:text-foreground sq:focus-visible:border-ring sq:focus-visible:ring-[3px] sq:focus-visible:ring-ring/50 sq:focus-visible:outline-1 sq:focus-visible:outline-ring sq:disabled:pointer-events-none sq:disabled:opacity-50 sq:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm sq:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none sq:dark:text-muted-foreground sq:dark:hover:text-foreground sq:[&_svg]:pointer-events-none sq:[&_svg]:shrink-0 sq:[&_svg:not([class*=size-])]:size-4",
        "sq:group-data-[variant=line]/tabs-list:bg-transparent sq:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent sq:dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent sq:dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "sq:data-[state=active]:bg-background sq:data-[state=active]:text-foreground sq:dark:data-[state=active]:border-input sq:dark:data-[state=active]:bg-input/30 sq:dark:data-[state=active]:text-foreground",
        "sq:after:absolute sq:after:bg-foreground sq:after:opacity-0 sq:after:transition-opacity sq:group-data-[orientation=horizontal]/tabs:after:inset-x-0 sq:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] sq:group-data-[orientation=horizontal]/tabs:after:h-0.5 sq:group-data-[orientation=vertical]/tabs:after:inset-y-0 sq:group-data-[orientation=vertical]/tabs:after:-right-1 sq:group-data-[orientation=vertical]/tabs:after:w-0.5 sq:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("sq:flex-1 sq:outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
