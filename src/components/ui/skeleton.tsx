import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("sq:animate-pulse sq:rounded-md sq:bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
