# Raspberry Pi Setup Guide

## Prerequisites

1. Docker and Docker Compose installed (see `DEPLOYMENT.md`)
2. GitHub repository with access to set secrets

## Setup Steps

### 1. Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

   **Secret 1:**
   - Name: `SPOTIFY_CLIENT_ID`
   - Value: Your Spotify Client ID (from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard))

   **Secret 2:**
   - Name: `SPOTIFY_CLIENT_SECRET`
   - Value: Your Spotify Client Secret (from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard))

4. Click **Add secret** for each

### 2. Deploy

The GitHub Actions workflow will automatically:
1. Use the secrets when deploying
2. Pass them as environment variables to Docker Compose
3. Inject them into the container

Just push your changes to the `main` branch and the workflow will handle everything!

### 3. Verify Spotify Credentials are Loaded

After deployment, SSH into your Raspberry Pi and check the logs:

```bash
ssh <SSH_USERNAME>@your-pi-ip
cd /home/<SSH_USERNAME>/guessthesong-backend
docker compose logs backend | grep -i spotify
```

You should see:
```
Spotify credentials loaded (Client ID configured)
```

If you see warnings, check that the secrets are correctly set in GitHub.

## Getting Your Spotify Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click on your app (or create a new one)
4. Copy the **Client ID** and **Client Secret**
5. Add them as GitHub secrets (see step 1 above)

## Troubleshooting

### Credentials not loading

1. **Check GitHub secrets are set:**
   - Go to Settings → Secrets and variables → Actions
   - Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` exist

2. **Check workflow logs:**
   - Go to Actions tab in GitHub
   - Check the latest workflow run for errors

3. **Check container logs:**
   ```bash
   docker compose logs backend
   ```

### Container won't start

1. Check if port 8080 is already in use: `sudo lsof -i :8080`
2. Check Docker logs: `docker compose logs backend`
3. Verify the workflow completed successfully in GitHub Actions

## Security Best Practices

✅ **Secrets are stored securely in GitHub** - They're encrypted and only accessible during workflow runs  
✅ **No secrets in code** - Everything is handled via GitHub secrets  
✅ **Secrets are masked in logs** - GitHub automatically masks secret values in workflow output
