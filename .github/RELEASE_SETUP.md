# Setup Instructions for Two-Repository Approach

This guide will help you set up the two-repository workflow where your private repo publishes releases to a public repo.

## Overview

- **Private Repo**: `Andersang/Panopticon` (your current repo) - Contains source code
- **Public Repo**: `Andersang/Panopticon` (to be created) - Contains only releases and documentation

## Step-by-Step Setup

### 1. Create the Public Repository

1. Go to https://github.com/new
2. **Repository name**: `Panopticon`
3. **Visibility**: **Public** ✓
4. **Initialize**: Do NOT check any boxes (we'll push content from here)
5. Click **Create repository**

### 2. Create Personal Access Token (PAT)

1. Go to https://github.com/settings/tokens/new
2. **Note**: `Panopticon Release Publisher`
3. **Expiration**: Choose your preference (recommend 1 year)
4. **Select scopes**:
   - ✓ `repo` (all sub-options)
   - ✓ `workflow`
5. Click **Generate token**
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### 3. Add Token as Secret to Private Repo

1. Go to your private repo: https://github.com/Andersang/Panopticon/settings/secrets/actions
2. Click **New repository secret**
3. **Name**: `PUBLIC_REPO_TOKEN`
4. **Secret**: Paste the PAT you just created
5. Click **Add secret**

### 4. Initialize the Public Repository

From your private repo folder, run these commands:

```powershell
# Create a temporary directory for public repo content
mkdir temp-public-repo
cd temp-public-repo

# Initialize git
git init
git branch -M main

# Copy necessary files from private repo
Copy-Item ..\LICENSE .
Copy-Item ..\CONTRIBUTING.md .
Copy-Item ..\.github\public-repo-README.md .\README.md
Copy-Item -Recurse ..\release-notes .

# Create initial commit
git add .
git commit -m "Initial setup for public releases repository"

# Add remote and push
git remote add origin https://github.com/Andersang/Panopticon.git
git push -u origin main

# Return to main repo and cleanup
cd ..
Remove-Item -Recurse -Force temp-public-repo
```

### 5. Test the Workflow

```powershell
# Make sure you're in your private repo
cd C:\Users\AA\Documents\Development\Panopticon

# Create a test tag
git tag -a v0.1.0 -m "Initial release"

# Push the tag (this triggers the GitHub Action)
git push origin v0.1.0
```

The GitHub Action will:
1. Build your application
2. Read release notes from `release-notes/v0.1.0.md`
3. Create a release in the **public** repo
4. Upload the `.exe` file as a release asset

### 6. Verify the Release

1. Go to: https://github.com/Andersang/Panopticon/releases
2. You should see your release with the `.exe` file attached
3. Test the download link works publicly (try in incognito mode)

## Future Releases

For every new release:

1. **Update version** in `package.json`
2. **Create release notes**: `release-notes/vX.Y.Z.md`
3. **Commit changes**: `git commit -am "Release vX.Y.Z"`
4. **Create tag**: `git tag -a vX.Y.Z -m "Version X.Y.Z"`
5. **Push tag**: `git push origin vX.Y.Z`

That's it! GitHub Actions handles the rest automatically.

## Share Download Link

Share this URL for downloads:
```
https://github.com/Andersang/Panopticon/releases/latest
```

Or for specific version:
```
https://github.com/Andersang/Panopticon/releases/download/vX.Y.Z/Panopticon-Setup-X.Y.Z.exe
```

## Troubleshooting

### Workflow Fails with "Resource not accessible by integration"
- Check that `PUBLIC_REPO_TOKEN` is set correctly in repository secrets
- Verify the token has `repo` and `workflow` permissions

### Release not appearing in public repo
- Check GitHub Actions tab in private repo for error logs
- Verify public repo name is correct: `Andersang/Panopticon`

### Token Expired
- Generate new PAT following Step 2
- Update `PUBLIC_REPO_TOKEN` secret following Step 3

## Updating Public Repo Documentation

If you want to update the README or other docs in the public repo:

```powershell
# Clone public repo
git clone https://github.com/Andersang/Panopticon.git
cd Panopticon

# Make changes to README.md, etc.
# Commit and push
git add .
git commit -m "Update documentation"
git push
```

Or keep documentation in sync automatically by copying from private repo before releases.
