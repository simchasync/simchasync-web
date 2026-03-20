import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BookingCalendarProps {
  events: any[];
  onEventClick: (event: any) => void;
}

export default function BookingCalendar({ events, onEventClick }: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of calendar to align with weekday
  const startPadding = getDay(monthStart); // 0 = Sunday

  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    events.forEach((ev) => {
      const key = ev.event_date; // YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [events]);

  const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setCurrentMonth(new Date());

  const statusDot = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-500";
      case "partial": return "bg-amber-500";
      default: return "bg-red-500";
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Calendar header */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToday}>
              Today
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px">
          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] md:min-h-[100px] bg-muted/30 rounded-md" />
          ))}

          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(dateKey) || [];
            const today = isToday(day);

            return (
              <div
                key={dateKey}
                className={cn(
                  "min-h-[80px] md:min-h-[100px] rounded-md border p-1 transition-colors",
                  today ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50",
                  !isSameMonth(day, currentMonth) && "opacity-40"
                )}
              >
                <p className={cn(
                  "text-xs font-medium mb-0.5",
                  today ? "text-primary font-bold" : "text-muted-foreground"
                )}>
                  {format(day, "d")}
                </p>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev: any) => (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left rounded px-1 py-0.5 text-[10px] md:text-xs font-medium truncate bg-accent hover:bg-accent/80 transition-colors flex items-center gap-1"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot(ev.payment_status))} />
                      <span className="truncate">
                        {ev.clients?.name || ev.event_type}
                      </span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
