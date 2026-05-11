# Deploy

## Remote Helper

Copy the remote helper to `124`:

```powershell
scp integrations\napcat-control\backend\remote\send_napcat_group.py `
  ubuntu@124.220.233.126:/home/ubuntu/multica-public-watch/control/send_napcat_group.py
```

Then mark it executable:

```bash
ssh ubuntu@124.220.233.126 "chmod +x /home/ubuntu/multica-public-watch/control/send_napcat_group.py"
```

## Reverse Proxy

1. Create DNS `napcat.tengokukk.com -> 124.220.233.126`
2. Install the nginx site config from `backend/nginx/napcat.tengokukk.com.conf`
3. Enable it and request TLS:

```bash
sudo ln -sf /etc/nginx/sites-available/napcat.tengokukk.com.conf /etc/nginx/sites-enabled/napcat.tengokukk.com.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d napcat.tengokukk.com
```

## Verify

- `https://napcat.tengokukk.com/webui/`
- `https://napcat.tengokukk.com/webui/network`
- local Mortis wrapper:

```powershell
integrations/napcat-control/backend/send-mortis-group.ps1 `
  -Body "Mortis NapCat deploy verification" `
  -TemplateKey notify `
  -SourceTag mortis-ops
```
