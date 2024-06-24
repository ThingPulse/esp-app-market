import { Partition } from "../services/utils.service";

export interface AppVersion {
    name: string;
    partitions: Partition[];
}