# Frequently Asked Questions (FAQ)

This document answers common questions about NaijaTaste AI.

## General Questions

### What is NaijaTaste AI?

NaijaTaste AI is a Nigerian restaurant discovery platform that uses artificial intelligence to provide personalized restaurant recommendations based on your preferences, location, and budget. It combines AI-powered chat with traditional search to help you find the perfect dining spot.

### How does it work?

NaijaTaste AI uses a ReAct (Reasoning and Acting) AI agent that understands your preferences through natural language conversation. It then searches through restaurant data, scores matches based on your criteria, and provides ranked recommendations with detailed reasoning.

### Is it free to use?

Yes, NaijaTaste AI is currently free to use. The platform is in beta testing, and we're focused on gathering feedback and improving the service before potentially introducing premium features.

### What cities are covered?

Currently, NaijaTaste AI covers major Nigerian cities including Lagos, Abuja, and Port Harcourt. We're continuously expanding to more cities across Nigeria.

### How accurate are the recommendations?

Our AI-powered recommendations are highly accurate, especially when you provide detailed information about your preferences. The system learns from your feedback and improves over time. We also have a deterministic fallback system that ensures you always get good recommendations even when the AI service is unavailable.

## Account and Authentication

### How do I create an account?

To create an account:
1. Visit the app at [https://naijataste-ai.vercel.app](https://naijataste-ai.vercel.app)
2. Click on "Sign Up"
3. Fill in your name, email, and password
4. Click "Create Account"

### What are the password requirements?

Passwords must:
- Be at least 8 characters long
- Contain at least one uppercase letter
- Contain at least one lowercase letter
- Contain at least one number
- Contain at least one special character

### Can I sign up with Google?

Yes, you can sign up using your Google account. Click the "Sign in with Google" button on the login page.

### How do I reset my password?

To reset your password:
1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for a reset link
5. Follow the link to create a new password

### How do I delete my account?

To delete your account:
1. Go to Settings
2. Scroll to the bottom
3. Click "Delete Account"
4. Confirm the deletion

Note: This action is permanent and cannot be undone.

## AI and Recommendations

### How does the AI understand my preferences?

The AI uses natural language processing to extract key information from your conversations, including:
- Location preferences
- Budget constraints
- Dietary restrictions
- Cuisine preferences
- Ambience preferences
- Spice tolerance

### What happens if the AI service is down?

If the AI service (Gemini) is unavailable, the system automatically switches to a deterministic fallback mode. This mode uses pre-scored restaurant data based on your criteria to provide reliable recommendations.

### Can I save my preferences?

Yes, you can save your preferences in your profile. These preferences will be used to personalize future recommendations.

### How do I give feedback on recommendations?

You can provide feedback by:
- Rating restaurants (1-5 stars)
- Writing reviews
- Using the "Not interested" option
- Reporting inaccurate information

### Can I refine my search?

Yes, you can refine your search by:
- Being more specific in your requests
- Using filters like price range, cuisine type, or location
- Providing feedback on recommendations
- Updating your preferences

## Technical Questions

### What technology stack does NaijaTaste AI use?

NaijaTaste AI is built with:
- **Backend**: Node.js 24, Express.js, PostgreSQL
- **Frontend**: React 19, Vite 8, Leaflet maps
- **AI**: Google Gemini API
- **Authentication**: JWT, bcrypt, Google OAuth
- **Database**: Neon (PostgreSQL)
- **Deployment**: Vercel

### Is the app available offline?

NaijaTaste AI is a Progressive Web App (PWA) that supports offline functionality. Basic features like viewing saved restaurants and reading reviews work offline. However, features that require real-time data (like searching or getting new recommendations) need an internet connection.

### How secure is my data?

Your data is protected with:
- HTTPS encryption for all communications
- JWT-based authentication
- Secure password hashing (bcrypt)
- Rate limiting to prevent abuse
- Regular security audits
- GDPR-compliant data handling

### How can I report a bug or issue?

To report a bug:
1. Use the "Report" feature in the app
2. Describe the issue in detail
3. Include steps to reproduce the problem
4. If possible, include screenshots
5. Your report will be reviewed and addressed

### What browsers are supported?

NaijaTaste AI supports all modern browsers:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

For the best experience, we recommend using the latest version of your preferred browser.

## Business and Partnership Questions

### How can my restaurant be listed on NaijaTaste AI?

Restaurants can be added to the platform through our data import process. We source restaurant data from OpenStreetMap and other public sources. If your restaurant is missing, you can:
1. Report it through the app
2. Contact us through our website
3. Claim your listing once it's added

### How much does it cost to be listed?

Currently, being listed on NaijaTaste AI is free. We may introduce premium features for restaurant owners in the future, but basic listings will remain free.

### Can I advertise my restaurant on Naijataste AI?

We're currently focused on building the best user experience and don't have advertising features. However, we may introduce promotional opportunities for restaurants in the future.

### How do you ensure restaurant information is accurate?

We use multiple sources to verify restaurant information:
- OpenStreetMap data
- User reports and feedback
- Direct verification with restaurant owners
- Regular data quality checks

### Can I update my restaurant information?

Yes, restaurant owners can claim their listings and update information like:
- Menu updates
- Photos
- Operating hours
- Contact information
- Special offers

## Privacy and Data Questions

### What data do you collect?

We collect:
- Account information (name, email)
- Location data (when you search for nearby restaurants)
- Usage data (searches, preferences, ratings)
- Device information (browser type, device type)

### How is my data used?

Your data is used to:
- Provide personalized recommendations
- Improve the AI models
- Fix bugs and improve features
- Ensure the platform's security

### Do you share my data with third parties?

We don't sell or share your personal data with third parties. However, we use:
- Google Gemini for AI processing
- Vercel for hosting
- Neon for database services
- Analytics services for understanding usage patterns

### Can I export my data?

Yes, you can request an export of your data by contacting support. This includes:
- Your profile information
- Your ratings and reviews
- Your saved places
- Your search history

### How long do you keep my data?

We keep your data as long as your account is active. If you delete your account, we'll permanently delete your data within 30 days, except where required by law to retain certain information.

## Development and Contribution Questions

### How can I contribute to NaijaTaste AI?

We welcome contributions! You can:
1. Report bugs and suggest features
2. Write code (see our contribution guidelines)
3. Improve documentation
4. Translate the app to other languages
5. Spread the word about Naijataste AI

### What are the technical requirements for contributing?

- Node.js 24
- Basic knowledge of JavaScript/TypeScript
- Understanding of React and Node.js
- Familiarity with Git and GitHub
- Willingness to learn and follow our coding standards

### How do I report a security vulnerability?

If you discover a security vulnerability, please:
1. Don't disclose it publicly
2. Email security@naijataste-ai.com
3. Provide detailed information about the vulnerability
4. Allow us time to fix it before public disclosure

### Can I use the API for my own application?

Currently, we don't offer a public API. However, we're planning to open up an API for third-party developers in the future. Sign up for our newsletter to stay updated on API availability.

### How can I stay updated on new features?

You can:
1. Follow us on social media
2. Subscribe to our newsletter
3. Check the app's changelog
4. Join our community forum

## Troubleshooting

### The app is not loading. What should I do?

Try these steps:
1. Check your internet connection
2. Refresh the page
3. Clear your browser cache
4. Try a different browser
5. Check if there are any service announcements

### My search isn't working. What's wrong?

Search issues could be caused by:
- Poor internet connection
- Browser compatibility issues
- Temporary service disruptions
- Location services not enabled

Try refreshing the page or enabling location services.

### I'm not getting good recommendations. How can I improve them?

To get better recommendations:
1. Be more specific in your requests
2. Update your preferences in your profile
3. Provide feedback on recommendations
4. Try different ways to describe what you want
5. Use the "Not interested" option to filter out unsuitable options

### I can't sign in. What should I do?

Sign-in issues could be due to:
- Incorrect email or password
- Account not verified (check your email)
- Temporary service disruptions
- Browser compatibility issues

Try resetting your password or using a different browser.

### The app is too slow. What can I do?

Performance issues can be caused by:
- Slow internet connection
- Browser cache issues
- High server load
- Background processes

Try refreshing the page, clearing your cache, or trying again later.

### I'm seeing error messages. What do they mean?

Common error messages:
- "Network Error": Check your internet connection
- "Service Unavailable": Try again later
- "Invalid Credentials": Check your email and password
- "Rate Limited": Wait a few minutes and try again

For specific error messages, check our troubleshooting guide or contact support.

## Contact and Support

### How can I contact support?

You can contact support through:
- The "Report" feature in the app
- Email: support@naijataste-ai.com
- Social media: @naijataste_ai

### What are your support hours?

Our support team is available:
- Monday to Friday: 9 AM - 6 PM WAT
- Saturday: 10 AM - 4 PM WAT
- Sunday: Closed

We typically respond to support requests within 24 hours.

### How long does it take to get a response?

We aim to respond to all support requests within 24 hours. For urgent issues, we'll try to respond within 4 hours during business hours.

### Can I request a feature?

Yes! We love hearing feature requests. You can:
1. Use the "Report" feature in the app
2. Email features@naijataste-ai.com
3. Create an issue on GitHub
4. Suggest it in our community forum

### How do I stay updated on app changes?

You can stay updated by:
- Checking the app's changelog
- Following us on social media
- Subscribing to our newsletter
- Joining our community forum

---

This FAQ is a living document that will be updated regularly based on user questions and feedback. If you have a question that's not answered here, please contact us!