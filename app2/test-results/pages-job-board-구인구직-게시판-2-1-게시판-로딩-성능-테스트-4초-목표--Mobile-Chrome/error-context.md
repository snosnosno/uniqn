# Page snapshot

```yaml
- button "한국어"
- button "English"
- heading "Login" [level=2]
- text: Email Address
- textbox "Email Address": newuser@test.com
- text: Password
- textbox "Password": user123
- button "Show password"
- paragraph: Failed to log in. Please check your email and password.
- link "Forgot your password?":
  - /url: /forgot-password
- button "Sign In"
- text: Or continue with
- button "Sign in with Google":
  - img
  - text: Sign in with Google
- link "Don't have an account? Sign Up":
  - /url: /signup
```