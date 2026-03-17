module.exports = {
  apps: [
    {
      name: 'kyronmed',
      cwd: './server',
      script: 'server.js',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
