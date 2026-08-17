import { FLOW_STATUS_LABELS, FlowStatusIcon } from '@/components/icons/flow-status-icon';
import { Badge } from '@/components/ui/badge';
import { StatusType } from '@/graphql/types';
import { cn } from '@/lib/utils';

const STATUS_BADGE_CLASS: Record<StatusType, string> = {
    [StatusType.Created]: 'border-blue-500/40 text-blue-600',
    [StatusType.Failed]: 'border-red-500/40 text-red-600',
    [StatusType.Finished]: 'border-green-500/40 text-green-700',
    [StatusType.Running]: 'border-purple-500/40 text-purple-700',
    [StatusType.Waiting]: 'border-yellow-500/50 text-yellow-700',
};

export function FlowStatusBadge({ className, status }: { className?: string; status: StatusType }) {
    return (
        <Badge
            className={cn('gap-1.5 px-2 py-0.5 text-xs font-medium', STATUS_BADGE_CLASS[status], className)}
            variant="outline"
        >
            <FlowStatusIcon
                className="size-3.5"
                status={status}
            />
            {FLOW_STATUS_LABELS[status]}
        </Badge>
    );
}
