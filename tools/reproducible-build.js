import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// A minimal, deterministic POSIX tar builder (ustar format)
// Eliminates cross-platform (Mac vs Linux) tar CLI differences.
class TarBuilder {
  constructor() {
    this.buffers = [];
  }

  // Format number as zero-padded octal, null-terminated
  octal(num, size) {
    const octStr = num.toString(8);
    return octStr.padStart(size - 1, '0') + '\0';
  }

  addFile(filePath, contentBuffer) {
    // Standard POSIX tar header (512 bytes)
    const header = Buffer.alloc(512, 0);
    
    // File name (100 bytes)
    header.write(filePath, 0, 100, 'utf8');
    
    // File mode (8 bytes) - fixed to 0644 for reproducibility
    header.write(this.octal(0o644, 8), 100);
    
    // Owner's numeric user ID (8 bytes) - fixed to 0
    header.write(this.octal(0, 8), 108);
    
    // Group's numeric user ID (8 bytes) - fixed to 0
    header.write(this.octal(0, 8), 116);
    
    // File size in bytes (12 bytes)
    header.write(this.octal(contentBuffer.length, 12), 124);
    
    // Last modification time in numeric Unix time format (12 bytes)
    // Fixed epoch: 1704067200 (2024-01-01T00:00:00Z)
    header.write(this.octal(1704067200, 12), 136);
    
    // Checksum (8 bytes) - computed later
    header.write('        ', 148); // 8 spaces initially
    
    // Type flag (1 byte) - '0' for normal file
    header.write('0', 156);
    
    // USTAR Indicator (6 bytes)
    header.write('ustar\0', 257);
    
    // USTAR Version (2 bytes)
    header.write('00', 263);

    // Compute checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    // Write checksum (6 digits + null + space)
    header.write(this.octal(checksum, 7) + ' ', 148);

    this.buffers.push(header);
    
    this.buffers.push(contentBuffer);
    
    // Pad content to 512 bytes
    const padding = 512 - (contentBuffer.length % 512);
    if (padding < 512) {
      this.buffers.push(Buffer.alloc(padding, 0));
    }
  }

  finalize() {
    // Two 512-byte blocks of zeros mark the end of the archive
    this.buffers.push(Buffer.alloc(1024, 0));
    return Buffer.concat(this.buffers);
  }
}

function getAllFiles(dirPath, arrayOfFiles = [], basePath = '') {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    if (file === '.DS_Store' || file.startsWith('.')) continue;
    
    const fullPath = path.join(dirPath, file);
    const relPath = path.posix.join(basePath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles, relPath);
    } else {
      arrayOfFiles.push({ fullPath, relPath });
    }
  }
  
  return arrayOfFiles;
}

function build() {
  console.log('Starting deterministic reproducible build...\n');
  
  const rootDir = process.cwd();
  
  // 1. Collect all source files we want to package
  let filesToPackage = [];
  ['src', 'public', 'bin', 'docs'].forEach(dir => {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      filesToPackage = filesToPackage.concat(getAllFiles(dirPath, [], dir));
    }
  });
  
  // Include specific root files
  ['package.json', 'README.md', 'SECURITY.md', 'STDLIB.md'].forEach(file => {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      filesToPackage.push({ fullPath, relPath: file });
    }
  });

  // 2. Sort files alphabetically by relative path to ensure deterministic ordering
  filesToPackage.sort((a, b) => a.relPath.localeCompare(b.relPath));

  // 3. Build Tar
  const tar = new TarBuilder();
  for (const file of filesToPackage) {
    const content = fs.readFileSync(file.fullPath);
    tar.addFile(file.relPath, content);
  }

  const tarBuffer = tar.finalize();
  
  // 4. Output artifact
  const outPath = path.join(rootDir, 'zerovault-release.tar');
  fs.writeFileSync(outPath, tarBuffer);
  
  // 5. Compute SHA-256
  const hash = createHash('sha256').update(tarBuffer).digest('hex');
  
  console.log('BUILD COMMAND: node tools/reproducible-build.js');
  console.log(`OUTPUT ARTIFACT: ${outPath}`);
  console.log(`ARTIFACT SHA-256: ${hash}\n`);
  console.log('SUCCESS: Build complete. Run again to verify deterministic hash.');
}

build();
