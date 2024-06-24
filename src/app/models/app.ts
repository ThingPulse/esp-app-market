import { Partition } from "../services/utils.service";
import { AppVersion } from "./app-version";

export interface App {
    id: string;
    name: string;
    description: string;
    version: string;
    repository: string;
    appIcon: string;
    instructions: string;
    supportedDevices: string[];
    versions: AppVersion[];
    tags: string[];
}