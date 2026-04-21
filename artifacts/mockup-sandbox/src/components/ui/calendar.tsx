@@ -104,54 +104,55 @@ function Calendar({
           defaultClassNames.day
         ),
         range_start: cn(
           "bg-accent rounded-l-md",
           defaultClassNames.range_start
         ),
         range_middle: cn("rounded-none", defaultClassNames.range_middle),
         range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
         today: cn(
           "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
           defaultClassNames.today
         ),
         outside: cn(
           "text-muted-foreground aria-selected:text-muted-foreground",
           defaultClassNames.outside
         ),
         disabled: cn(
           "text-muted-foreground opacity-50",
           defaultClassNames.disabled
         ),
         hidden: cn("invisible", defaultClassNames.hidden),
         ...classNames,
       }}
       components={{
         Root: ({ className, rootRef, ...props }) => {
+          const resolvedRootRef = rootRef as unknown as React.Ref<HTMLDivElement>
           return (
             <div
               data-slot="calendar"
-              ref={rootRef}
+              ref={resolvedRootRef}
               className={cn(className)}
               {...props}
             />
           )
         },
         Chevron: ({ className, orientation, ...props }) => {
           if (orientation === "left") {
             return (
               <ChevronLeftIcon className={cn("size-4", className)} {...props} />
             )
           }
 
           if (orientation === "right") {
             return (
               <ChevronRightIcon
                 className={cn("size-4", className)}
                 {...props}
               />
             )
           }
 
           return (
             <ChevronDownIcon className={cn("size-4", className)} {...props} />
           )
         },
