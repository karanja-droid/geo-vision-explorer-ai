#!/usr/bin/env python3
"""
GeoVision AI Miner - Deployment Status Checker
Comprehensive check of deployment status and configuration
"""

import requests
import json
import os
import sys
from pathlib import Path
from datetime import datetime
import subprocess

class DeploymentChecker:
    def __init__(self):
        self.site_url = "https://sunny-pasca-eed8fc.netlify.app"
        self.api_url = "http://localhost:8000"
        self.issues = []
        self.successes = []
    
    def print_header(self, title):
        print(f"\n{'='*60}")
        print(f"🔍 {title}")
        print(f"{'='*60}")
    
    def print_section(self, title):
        print(f"\n📋 {title}")
        print("-" * 40)
    
    def add_success(self, message):
        self.successes.append(message)
        print(f"   ✅ {message}")
    
    def add_issue(self, message):
        self.issues.append(message)
        print(f"   ❌ {message}")
    
    def add_warning(self, message):
        print(f"   ⚠️  {message}")
    
    def check_local_files(self):
        """Check if required deployment files exist"""
        self.print_section("Local File Check")
        
        required_files = [
            "package.json",
            "public/_redirects", 
            "netlify.toml",
            "src/pages/Auth.tsx",
            "src/integrations/supabase/client.ts",
            "api/stac_server.py",
            "data-ingestion/config.py"
        ]
        
        for file_path in required_files:
            if Path(file_path).exists():
                self.add_success(f"{file_path} exists")
            else:
                self.add_issue(f"{file_path} missing")
    
    def check_environment_variables(self):
        """Check environment variables"""
        self.print_section("Environment Variables")
        
        # Check .env.local
        env_file = Path(".env.local")
        if env_file.exists():
            self.add_success(".env.local file exists")
            
            with open(env_file, 'r') as f:
                content = f.read()
                
            if "VITE_SUPABASE_URL" in content:
                self.add_success("VITE_SUPABASE_URL configured")
            else:
                self.add_issue("VITE_SUPABASE_URL missing from .env.local")
                
            if "VITE_SUPABASE_ANON_KEY" in content:
                self.add_success("VITE_SUPABASE_ANON_KEY configured")
            else:
                self.add_issue("VITE_SUPABASE_ANON_KEY missing from .env.local")
        else:
            self.add_warning(".env.local not found (environment variables should be set in Netlify)")
    
    def check_build_process(self):
        """Test local build process"""
        self.print_section("Build Process Test")
        
        try:
            # Check if node_modules exists
            if Path("node_modules").exists():
                self.add_success("node_modules directory exists")
            else:
                self.add_warning("node_modules not found - running npm install")
                result = subprocess.run(["npm", "install"], capture_output=True, text=True)
                if result.returncode == 0:
                    self.add_success("npm install completed")
                else:
                    self.add_issue(f"npm install failed: {result.stderr}")
                    return
            
            # Test build
            print("   🔄 Testing build process...")
            result = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
            
            if result.returncode == 0:
                self.add_success("Build process successful")
                
                # Check build output
                if Path("dist").exists():
                    self.add_success("dist directory created")
                    
                    if Path("dist/index.html").exists():
                        self.add_success("index.html generated")
                    else:
                        self.add_issue("index.html not found in dist")
                        
                    if Path("dist/_redirects").exists():
                        self.add_success("_redirects file copied to dist")
                    else:
                        self.add_warning("_redirects file not found in dist")
                else:
                    self.add_issue("dist directory not created")
            else:
                self.add_issue(f"Build failed: {result.stderr}")
                
        except FileNotFoundError:
            self.add_issue("npm not found - please install Node.js")
        except Exception as e:
            self.add_issue(f"Build test error: {str(e)}")
    
    def check_netlify_deployment(self):
        """Check Netlify deployment status"""
        self.print_section("Netlify Deployment Status")
        
        try:
            # Test main site
            response = requests.get(self.site_url, timeout=10)
            
            if response.status_code == 200:
                self.add_success(f"Site accessible: {self.site_url}")
                
                # Check if it's actually the React app
                if "GeoVision" in response.text or "react" in response.text.lower():
                    self.add_success("React application loaded")
                else:
                    self.add_warning("Site loaded but may not be the React app")
            else:
                self.add_issue(f"Site returned HTTP {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.add_issue(f"Cannot access site: {str(e)}")
        
        # Test specific routes
        routes_to_test = [
            "/auth",
            "/projects", 
            "/analytics"
        ]
        
        for route in routes_to_test:
            try:
                response = requests.get(f"{self.site_url}{route}", timeout=5)
                if response.status_code == 200:
                    self.add_success(f"Route {route} accessible")
                else:
                    self.add_issue(f"Route {route} returned HTTP {response.status_code}")
            except requests.exceptions.RequestException:
                self.add_issue(f"Route {route} not accessible")
    
    def check_stac_api(self):
        """Check STAC API status"""
        self.print_section("STAC API Status")
        
        try:
            # Test health endpoint
            response = requests.get(f"{self.api_url}/health", timeout=5)
            
            if response.status_code == 200:
                self.add_success("STAC API health check passed")
                
                data = response.json()
                if data.get('status') == 'healthy':
                    self.add_success("API reports healthy status")
                else:
                    self.add_warning(f"API status: {data.get('status', 'unknown')}")
            else:
                self.add_issue(f"STAC API health check failed: HTTP {response.status_code}")
                
        except requests.exceptions.RequestException:
            self.add_warning("STAC API not accessible (may not be running)")
            self.add_warning("Start with: cd api && ./start_dev_server.sh")
        
        # Test STAC endpoints
        stac_endpoints = [
            "/",
            "/collections",
            "/search?limit=1"
        ]
        
        for endpoint in stac_endpoints:
            try:
                response = requests.get(f"{self.api_url}{endpoint}", timeout=5)
                if response.status_code == 200:
                    self.add_success(f"STAC endpoint {endpoint} working")
                else:
                    self.add_issue(f"STAC endpoint {endpoint} failed: HTTP {response.status_code}")
            except requests.exceptions.RequestException:
                self.add_warning(f"STAC endpoint {endpoint} not accessible")
    
    def check_git_status(self):
        """Check git repository status"""
        self.print_section("Git Repository Status")
        
        try:
            # Check if we're in a git repo
            result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
            
            if result.returncode == 0:
                if result.stdout.strip():
                    self.add_warning("Uncommitted changes detected")
                    print("     Uncommitted files:")
                    for line in result.stdout.strip().split('\n'):
                        print(f"       {line}")
                else:
                    self.add_success("No uncommitted changes")
                
                # Check current branch
                branch_result = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True)
                if branch_result.returncode == 0:
                    branch = branch_result.stdout.strip()
                    self.add_success(f"Current branch: {branch}")
                    
                    if branch != "main":
                        self.add_warning("Not on main branch - Netlify may not deploy")
                
                # Check remote status
                remote_result = subprocess.run(["git", "status", "-uno"], capture_output=True, text=True)
                if "Your branch is up to date" in remote_result.stdout:
                    self.add_success("Branch is up to date with remote")
                elif "Your branch is ahead" in remote_result.stdout:
                    self.add_warning("Local branch is ahead of remote - push changes")
                elif "Your branch is behind" in remote_result.stdout:
                    self.add_warning("Local branch is behind remote - pull changes")
                    
            else:
                self.add_issue("Not in a git repository")
                
        except FileNotFoundError:
            self.add_issue("Git not found")
        except Exception as e:
            self.add_issue(f"Git status check error: {str(e)}")
    
    def check_data_pipeline(self):
        """Check data ingestion pipeline status"""
        self.print_section("Data Pipeline Status")
        
        try:
            # Test simple pipeline components
            sys.path.insert(0, str(Path("data-ingestion")))
            
            # Test config loading
            try:
                from config import GlobalConfig
                config = GlobalConfig()
                self.add_success("Pipeline configuration loads successfully")
            except Exception as e:
                self.add_issue(f"Pipeline configuration error: {str(e)}")
            
            # Test STAC validator
            try:
                from stac_validator import STACValidator
                validator = STACValidator()
                self.add_success("STAC validator loads successfully")
            except Exception as e:
                self.add_issue(f"STAC validator error: {str(e)}")
                
        except Exception as e:
            self.add_issue(f"Pipeline check error: {str(e)}")
    
    def generate_report(self):
        """Generate final deployment report"""
        self.print_header("DEPLOYMENT STATUS REPORT")
        
        total_checks = len(self.successes) + len(self.issues)
        success_rate = len(self.successes) / total_checks * 100 if total_checks > 0 else 0
        
        print(f"📊 Overall Status: {len(self.successes)} successes, {len(self.issues)} issues")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if len(self.issues) == 0:
            print("\n🎉 DEPLOYMENT READY!")
            print("   All checks passed. The application should be fully functional.")
        elif len(self.issues) <= 2:
            print("\n✅ MOSTLY READY")
            print("   Minor issues detected but deployment should work.")
        else:
            print("\n⚠️  ISSUES DETECTED")
            print("   Several issues need to be addressed before deployment.")
        
        if self.issues:
            print(f"\n🔧 Issues to Address:")
            for i, issue in enumerate(self.issues, 1):
                print(f"   {i}. {issue}")
        
        print(f"\n💡 Next Steps:")
        if self.issues:
            print("   1. Address the issues listed above")
            print("   2. Run this checker again to verify fixes")
            print("   3. Deploy using: ./deploy.sh")
        else:
            print("   1. Deploy using: ./deploy.sh")
            print("   2. Configure environment variables in Netlify")
            print("   3. Test authentication flow")
        
        print(f"\n📞 Support:")
        print("   - Netlify Dashboard: https://app.netlify.com/sites/sunny-pasca-eed8fc")
        print("   - Supabase Dashboard: https://supabase.com/dashboard/project/rgtyhffyvpqenrqnkfqc")
        print("   - Local STAC API: cd api && ./start_dev_server.sh")
        
        return len(self.issues) == 0

def main():
    print("🌍 GeoVision AI Miner - Deployment Status Checker")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    checker = DeploymentChecker()
    
    # Run all checks
    checker.check_local_files()
    checker.check_environment_variables()
    checker.check_git_status()
    checker.check_build_process()
    checker.check_netlify_deployment()
    checker.check_stac_api()
    checker.check_data_pipeline()
    
    # Generate final report
    success = checker.generate_report()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())