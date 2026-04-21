@@ -1,16 +1,17 @@
+import type { ComponentProps } from "react"
 import { Loader2Icon } from "lucide-react"
 
 import { cn } from "@/lib/utils"
 
-function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
+function Spinner({ className, ...props }: Omit<ComponentProps<"svg">, "ref">) {
   return (
     <Loader2Icon
       role="status"
       aria-label="Loading"
       className={cn("size-4 animate-spin", className)}
       {...props}
     />
   )
 }
 
 export { Spinner }
