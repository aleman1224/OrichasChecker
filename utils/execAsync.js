import { exec } from 'child_process';
import { promisify } from 'util';

// Convertir exec en una versión que usa promesas
export const execAsync = promisify(exec); 