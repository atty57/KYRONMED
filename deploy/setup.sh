#!/bin/bash
# EC2 Bootstrap Script for KyronMed
# Run as: sudo bash setup.sh

set -e

echo "🏥 KyronMed EC2 Setup"
echo "====================="

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install Nginx
apt-get install -y nginx

# Install Certbot (Let's Encrypt)
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "✅ System packages installed"
echo ""
echo "Next steps:"
echo "1. Clone your repo to /opt/kyronmed"
echo "2. cd /opt/kyronmed && npm run setup"
echo "3. cp .env.example .env && nano .env  (fill in your keys)"
echo "4. cd server && npm run generate-slots"
echo "5. cd .. && npm run build"
echo "6. pm2 start deploy/ecosystem.config.js --env production"
echo "7. Copy deploy/nginx.conf to /etc/nginx/sites-available/kyronmed"
echo "8. ln -s /etc/nginx/sites-available/kyronmed /etc/nginx/sites-enabled/"
echo "9. Update server_name in nginx.conf with your domain"
echo "10. certbot --nginx -d yourdomain.com"
echo "11. systemctl restart nginx"
echo ""
echo "🎉 Done! Your app should be live at https://yourdomain.com"
