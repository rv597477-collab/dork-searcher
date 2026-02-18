// Dork Templates Library
// Categorized dork query templates for common use cases

export interface DorkTemplate {
  id: string;
  query: string;
  description: string;
}

export interface DorkCategory {
  id: string;
  name: string;
  icon: string;
  templates: DorkTemplate[];
}

export const DORK_TEMPLATES: DorkCategory[] = [
  {
    id: "admin-logins",
    name: "Admin & Logins",
    icon: "🔐",
    templates: [
      {
        id: "admin-url",
        query: "inurl:admin",
        description: "Find admin panels in URLs",
      },
      {
        id: "login-title",
        query: "intitle:login",
        description: "Pages with 'login' in title",
      },
      {
        id: "wp-login",
        query: "inurl:wp-login.php",
        description: "WordPress login pages",
      },
      {
        id: "admin-panel",
        query: "intitle:\"admin panel\"",
        description: "Admin panel pages",
      },
      {
        id: "phpmyadmin",
        query: "intitle:phpMyAdmin",
        description: "phpMyAdmin interfaces",
      },
      {
        id: "dashboard",
        query: "inurl:dashboard intitle:login",
        description: "Dashboard login pages",
      },
      {
        id: "admin-login",
        query: "inurl:admin/login.php",
        description: "Admin login PHP pages",
      },
    ],
  },
  {
    id: "sensitive-files",
    name: "Sensitive Files",
    icon: "📄",
    templates: [
      {
        id: "sql-files",
        query: "ext:sql",
        description: "SQL database files",
      },
      {
        id: "env-files",
        query: "ext:env",
        description: "Environment config files",
      },
      {
        id: "log-files",
        query: "ext:log",
        description: "Log files",
      },
      {
        id: "bak-files",
        query: "ext:bak",
        description: "Backup files",
      },
      {
        id: "config-files",
        query: "ext:config",
        description: "Configuration files",
      },
      {
        id: "xml-files",
        query: "ext:xml intext:password",
        description: "XML files containing passwords",
      },
      {
        id: "txt-password",
        query: "filetype:txt intext:password",
        description: "Text files with passwords",
      },
      {
        id: "ssh-keys",
        query: "filetype:pem intext:\"PRIVATE KEY\"",
        description: "SSH private keys",
      },
      {
        id: "db-dump",
        query: "intext:\"sql dump\"",
        description: "Database dump files",
      },
    ],
  },
  {
    id: "databases",
    name: "Databases",
    icon: "💾",
    templates: [
      {
        id: "sql-syntax-error",
        query: "intext:\"sql syntax error\"",
        description: "SQL syntax errors",
      },
      {
        id: "mysql-connect",
        query: "intext:\"Warning: mysql_connect()\"",
        description: "MySQL connection warnings",
      },
      {
        id: "mysql-query",
        query: "intext:\"Warning: mysql_query()\"",
        description: "MySQL query warnings",
      },
      {
        id: "mysql-num-rows",
        query: "intext:\"Warning: mysql_num_rows()\"",
        description: "MySQL num_rows warnings",
      },
      {
        id: "mysql-fetch-array",
        query: "intext:\"Warning: mysql_fetch_array()\"",
        description: "MySQL fetch_array warnings",
      },
      {
        id: "postgresql-error",
        query: "intext:\"PostgreSQL query failed\"",
        description: "PostgreSQL errors",
      },
      {
        id: "mongodb-error",
        query: "intext:\"MongoDB\" intext:\"error\"",
        description: "MongoDB errors",
      },
    ],
  },
  {
    id: "exposed-info",
    name: "Exposed Info",
    icon: "📂",
    templates: [
      {
        id: "index-of",
        query: "intitle:\"index of /\"",
        description: "Directory listings",
      },
      {
        id: "parent-directory",
        query: "intitle:\"parent directory\"",
        description: "Parent directory listings",
      },
      {
        id: "index-backup",
        query: "intitle:\"index of\" backup",
        description: "Backup directories",
      },
      {
        id: "index-password",
        query: "intitle:\"index of\" password",
        description: "Password directories",
      },
      {
        id: "index-admin",
        query: "intitle:\"index of\" admin",
        description: "Admin directories",
      },
      {
        id: "index-private",
        query: "intitle:\"index of\" private",
        description: "Private directories",
      },
      {
        id: "confidential-docs",
        query: "filetype:pdf confidential",
        description: "Confidential PDF documents",
      },
    ],
  },
  {
    id: "server-info",
    name: "Server Info",
    icon: "🖥️",
    templates: [
      {
        id: "apache-status",
        query: "intitle:\"Apache Status\"",
        description: "Apache server status pages",
      },
      {
        id: "php-info",
        query: "intitle:\"PHP Info\"",
        description: "PHP information pages",
      },
      {
        id: "nginx-status",
        query: "intitle:\"nginx status\"",
        description: "Nginx status pages",
      },
      {
        id: "server-test",
        query: "intitle:\"Test Page\" apache",
        description: "Apache test pages",
      },
      {
        id: "phpmyadmin-setup",
        query: "inurl:setup.php intitle:phpMyAdmin",
        description: "phpMyAdmin setup pages",
      },
      {
        id: "tomcat-manager",
        query: "intitle:\"Apache Tomcat\" intitle:\"Manager\"",
        description: "Tomcat manager pages",
      },
      {
        id: "jenkins",
        query: "intitle:\"Dashboard [Jenkins]\"",
        description: "Jenkins dashboards",
      },
    ],
  },
  {
    id: "network-devices",
    name: "Network Devices",
    icon: "🌐",
    templates: [
      {
        id: "router-login",
        query: "intitle:\"Router\" inurl:login",
        description: "Router login pages",
      },
      {
        id: "webcam",
        query: "inurl:view.shtml",
        description: "Network camera interfaces",
      },
      {
        id: "printer-web",
        query: "inurl:hp/device/ intitle:\"printer\"",
        description: "Network printer interfaces",
      },
      {
        id: "nas-login",
        query: "intitle:\"NAS\" intitle:\"login\"",
        description: "NAS login pages",
      },
    ],
  },
  {
    id: "cms-specific",
    name: "CMS Specific",
    icon: "⚙️",
    templates: [
      {
        id: "wp-config",
        query: "inurl:wp-config.php intext:DB_PASSWORD",
        description: "WordPress config files",
      },
      {
        id: "joomla",
        query: "inurl:configuration.php intext:\"var $password\"",
        description: "Joomla config files",
      },
      {
        id: "drupal",
        query: "intext:\"$databases\" inurl:settings.php",
        description: "Drupal config files",
      },
      {
        id: "magento",
        query: "inurl:local.xml intext:\"<password>\"",
        description: "Magento config files",
      },
    ],
  },
];

export function getDorkTemplate(categoryId: string, templateId: string): DorkTemplate | undefined {
  const category = DORK_TEMPLATES.find((cat) => cat.id === categoryId);
  return category?.templates.find((tmpl) => tmpl.id === templateId);
}

export function getAllTemplates(): DorkTemplate[] {
  return DORK_TEMPLATES.flatMap((cat) => cat.templates);
}

export function searchTemplates(query: string): { category: DorkCategory; template: DorkTemplate }[] {
  const lowerQuery = query.toLowerCase();
  const results: { category: DorkCategory; template: DorkTemplate }[] = [];

  DORK_TEMPLATES.forEach((category) => {
    category.templates.forEach((template) => {
      if (
        template.query.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        category.name.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ category, template });
      }
    });
  });

  return results;
}
