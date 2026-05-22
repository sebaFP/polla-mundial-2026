'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { COMPETITIONS, type Competition } from '@/lib/competitions'

const GROUPS = [
  { label: 'Internacional', codes: ['WC', 'CL', 'EL', 'UCL', 'EC', 'CA', 'FCWC', 'AC', 'WCF'] },
  { label: 'Ligas Top', codes: ['PL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL', 'ELC', 'BL2', 'SPL', 'BJL'] },
  { label: 'Américas y Resto', codes: ['BSA', 'ASL', 'MLS', 'CLI', 'CPD', 'JJL', 'AAL'] },
  { label: 'Copas', codes: ['FAC', 'DFB', 'CDR'] },
]

interface Props {
  value: Competition
  onChange: (c: Competition) => void
}

export function CompetitionSelector({ value, onChange }: Props) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal',
          'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          'transition-colors cursor-pointer',
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {value.emblem ? (
            <img src={value.emblem} alt="" className="h-4 w-4 object-contain shrink-0" />
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{value.name}</span>
          <span className="text-muted-foreground text-xs shrink-0">— {value.area}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width,24rem)] p-0">
        <Command>
          <CommandInput placeholder="Buscar torneo..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {GROUPS.map(group => {
              const comps = group.codes
                .map(code => COMPETITIONS.find(c => c.code === code))
                .filter(Boolean) as Competition[]
              if (comps.length === 0) return null
              return (
                <CommandGroup key={group.label} heading={group.label}>
                  {comps.map(comp => (
                    <CommandItem
                      key={comp.code}
                      value={`${comp.name} ${comp.area}`}
                      onSelect={() => {
                        onChange(comp)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value.code === comp.code ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {comp.emblem ? (
                        <img src={comp.emblem} alt="" className="h-4 w-4 object-contain mr-2 shrink-0" />
                      ) : (
                        <span className="h-4 w-4 mr-2 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{comp.name}</span>
                      <span className="text-muted-foreground text-xs ml-2 shrink-0">{comp.area}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
