import { Partition } from "../services/utils.service";

export interface App {
    id: string;
    name: string;
    description: string;
    version: string;
    repository: string;
    appIcon: string;
    instructions: string;
    supportedDevices: string[];
    partitions: Partition[];
    tags: string[];
}