import { Partition } from "../services/utils.service";

export interface AppVersion {
    name: string;
    partitions: Partition[];
    channel?: 'stable' | 'snapshot';
    publishedAt?: string;
    releaseUrl?: string;
    notes?: string;
}
