"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DatePicker } from "@/components/ui/date-picker";

export const description = "A stacked bar chart with a legend";

const chartConfig = {
  present: {
    label: "Present",
    color: "var(--chart-1)",
  },
  late: {
    label: "Late",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface ChartDataPoint {
  day: string;
  present: number;
  late: number;
}

interface ChartBarStackedProps {
  data: ChartDataPoint[];
  weekRange: string;
  selectedDate: string;
}

export function ChartBarStacked({
  data,
  weekRange,
  selectedDate,
}: ChartBarStackedProps) {
  return (
    <Card className="shadow-md w-full lg:flex-1 px-4">
      <CardHeader className="text-gray-600 dark:text-gray-300 pt-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Weekly Attendance Metrics
        </CardTitle>
        <CardAction className="animate-fade-in">
          <DatePicker selected={selectedDate} label={weekRange} />
        </CardAction>
      </CardHeader>
      <CardContent className="animate-fade-in pb-2">
        <ChartContainer
          config={chartConfig}
          className="w-full aspect-4/3 md:aspect-2/1 max-h-85"
        >
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="present"
              stackId="a"
              fill="var(--color-present)"
              radius={[0, 0, 10, 10]}
              isAnimationActive={true}
            />
            <Bar
              dataKey="late"
              stackId="a"
              fill="var(--color-late)"
              radius={[10, 10, 0, 0]}
              isAnimationActive={true}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      {/*<CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter>*/}
    </Card>
  );
}
