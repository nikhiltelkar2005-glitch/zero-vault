import fs from 'node:fs';
import path from 'node:path';

function checkDependencies() {
  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  const runtimeDepsCount = Object.keys(pkg.dependencies || {}).length;
  
  // Recursively search src/ for external imports
  let thirdPartyImportsCount = 0;
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (fullPath.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Match import statements: import { ... } from 'pkg'; or import * as ... from 'pkg';
        const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
        // Match require: require('pkg')
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const mod = match[1];
          if (!mod.startsWith('node:') && !mod.startsWith('.')) {
            thirdPartyImportsCount++;
            console.error(`Found external import in ${fullPath}: ${mod}`);
          }
        }
        while ((match = requireRegex.exec(content)) !== null) {
          const mod = match[1];
          if (!mod.startsWith('node:') && !mod.startsWith('.')) {
            thirdPartyImportsCount++;
            console.error(`Found external require in ${fullPath}: ${mod}`);
          }
        }
      }
    }
  }
  
  const srcPath = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcPath)) {
    scanDir(srcPath);
  }
  
  console.log('ZERO VAULT DEPENDENCY CHECK\n');
  console.log(`Runtime dependencies: ${runtimeDepsCount}`);
  console.log(`Third-party runtime imports: ${thirdPartyImportsCount}\n`);
  
  if (runtimeDepsCount === 0 && thirdPartyImportsCount === 0) {
    console.log('PASS — ZERO THIRD-PARTY RUNTIME DEPENDENCIES');
    process.exit(0);
  } else {
    console.error('FAIL — THIRD-PARTY RUNTIME DEPENDENCY FOUND');
    process.exit(1);
  }
}

checkDependencies();
