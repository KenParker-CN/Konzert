import * as React from "react"
import {Input as InputPrimitive} from "@base-ui/react/input"
import {cn} from "cn"

function Input({className, type, ...props}: React.ComponentProps<"input">) {
    return (
        <InputPrimitive
            type={type}
            data-slot="input"
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:font-medium file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm dark:aria-invalid:ring-destructive/40",
                className
            )}
            {...props}
        />
    )
}

export {Input}
