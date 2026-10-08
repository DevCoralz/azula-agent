/**
 * Command policy engine.
 *
 * Azula workspaces are shared infrastructure. This refuses anything that
 * mines crypto, attacks third parties, or destabilises the host. Security
 * and pentest tooling is allowed — the ban is on abuse, not on the category.
 */

export interface PolicyVerdict {
  allowed: boolean;
  reason?: string;
}

const DENY: { re: RegExp; reason: string }[] = [
  // Crypto mining / wallets / chain nodes
  { re: /\b(xmrig|ethminer|cgminer|bfgminer|cpuminer|minerd|nicehash|t-rex|phoenixminer|lolminer|nbminer|gminer|srbminer|teamredminer|xmr-stak|ccminer|verusminer)\b/i, reason: "Cryptocurrency mining is not permitted." },
  { re: /\b(stratum\+tcp|stratum2?:\/\/|randomx|ethash|kawpow|autolykos)\b/i, reason: "Mining pool protocols are not permitted." },
  { re: /\b(geth|besu|erigon|nethermind|solana-validator|bitcoind|litecoind|monerod)\b/i, reason: "Running blockchain nodes is not permitted." },

  // Stress / DDoS / abuse tooling
  { re: /\b(hping3|slowloris|loic|hoic|mhddos|torshammer|goldeneye|t50|yersinia|bonesi)\b/i, reason: "Denial-of-service tooling is not permitted." },
  { re: /\b(ab|siege|wrk|vegeta|hey|k6)\b\s+[^|;&]*https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i, reason: "Load testing is only allowed against localhost." },
  { re: /\b(masscan|zmap)\b/i, reason: "Internet-wide scanning is not permitted." },
  { re: /\bnmap\b[^|;&]*\b(0\.0\.0\.0\/0|\/8|\/12|\/16)\b/i, reason: "Large external network scans are not permitted." },

  // Spam / relays / tunnels
  { re: /\b(sendmail|swaks|smtp-user-enum)\b[^|;&]*--?(to|rcpt)/i, reason: "Bulk mail sending is not permitted." },
  { re: /\b(ngrok|frpc|cloudflared|localtunnel|bore|pagekite|chisel)\b/i, reason: "Outbound tunnels are not permitted. Use the built-in live preview." },
  { re: /\b(tor|torsocks|proxychains|3proxy|squid)\b/i, reason: "Running proxies or anonymising relays is not permitted." },

  // Host destruction / escape
  { re: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]+\s+)*\/(\s|$)/, reason: "Refusing to delete the filesystem root." },
  { re: /:\s*\(\s*\)\s*\{.*\|.*&\s*\}\s*;/, reason: "Fork bombs are not permitted." },
  { re: /\b(mkfs(\.\w+)?|fdisk|parted|dd)\b[^|;&]*\bof=\/dev\//i, reason: "Direct disk writes are not permitted." },
  { re: />\s*\/dev\/(sd[a-z]|nvme\d|mem|kmem)\b/i, reason: "Direct device writes are not permitted." },
  { re: /\b(shutdown|reboot|halt|poweroff|init\s+0|systemctl\s+(stop|disable|mask))\b/i, reason: "Host power and service control is not permitted." },
  { re: /\b(insmod|rmmod|modprobe|sysctl\s+-w|setcap|chroot)\b/i, reason: "Kernel and capability changes are not permitted." },
  { re: /\b(sudo|su|doas|pkexec)\b/, reason: "Privilege escalation is not available in the workspace." },
  { re: /\b(docker|podman|kubectl|nsenter|lxc)\b/i, reason: "Container control is not available inside the workspace." },
  { re: /\/(etc\/(shadow|sudoers|passwd)|proc\/\d+\/mem|root\/\.ssh)/, reason: "That path is outside your workspace." },
  { re: /\b(iptables|nft|ip6tables|ufw|route|ifconfig|ip\s+link)\b/i, reason: "Network configuration is not permitted." },
  { re: /\bcrontab\b|\bat\s+now\b|\bsystemd-run\b/i, reason: "Scheduling background jobs outside the workspace is not permitted." },
];

/** Commands that are explicitly fine even though a broad rule might catch them. */
const ALLOW_PREFIX = [
  "npm", "pnpm", "yarn", "bun", "npx", "node", "tsx", "deno",
  "python", "python3", "pip", "pip3", "pipx", "poetry", "uv",
  "go", "cargo", "rustc", "java", "javac", "mvn", "gradle",
  "php", "composer", "ruby", "gem", "bundle", "dotnet",
  "git", "make", "cmake", "gcc", "g++", "clang",
  "ls", "cat", "head", "tail", "grep", "rg", "find", "sed", "awk", "wc", "sort", "uniq",
  "mkdir", "touch", "cp", "mv", "echo", "printf", "pwd", "cd", "tree", "diff", "patch",
  "curl", "wget", "jq", "yq", "tar", "unzip", "zip", "gzip", "openssl", "base64",
  "eslint", "prettier", "vitest", "jest", "pytest", "tsc",
  "nmap", "nikto", "sqlmap", "gobuster", "ffuf", "dirb", "hydra", "john", "hashcat",
  "nuclei", "amass", "subfinder", "httpx", "trivy", "semgrep", "bandit", "gitleaks",
  "whois", "dig", "host", "nslookup", "ping", "traceroute", "netstat", "ss", "lsof",
];

export function checkCommand(command: string): PolicyVerdict {
  const cmd = command.trim();
  if (!cmd) return { allowed: false, reason: "Empty command." };
  if (cmd.length > 4000) return { allowed: false, reason: "Command is too long." };

  for (const rule of DENY) {
    if (rule.re.test(cmd)) return { allowed: false, reason: rule.reason };
  }
  return { allowed: true };
}

/** Tool installs go through the same policy plus a package-name check. */
const DENY_PACKAGES = /\b(xmrig|cpuminer|ethminer|nicehash|coinhive|crypto-?miner|web3-miner|loic|hoic|mhddos|ngrok|cloudflared|frpc|chisel)\b/i;

export function checkPackage(name: string): PolicyVerdict {
  if (!/^[@a-zA-Z0-9][\w./@+-]{0,120}$/.test(name)) return { allowed: false, reason: "Invalid package name." };
  if (DENY_PACKAGES.test(name)) return { allowed: false, reason: "That package is on the blocked list." };
  return { allowed: true };
}

export const allowedCommandHints = ALLOW_PREFIX;
