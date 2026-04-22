#Flo — Personal Finance Tracker

Flo is a lightweight, modern personal finance tracking web app designed to help users manage income, expenses, and budgets with clarity and simplicity. It runs entirely in the browser with no backend required.

# Features

-Core Functionality
•Track income and expenses with categories
•Real-time balance calculation
•Monthly financial overview with visual charts
•Transaction history with search and filters
•Category-based expense breakdown
•Budget Management
•Create monthly budgets per category
Visual progress indicators
•Spending alerts based on usage percentage

# User Experience

-Clean, modern UI with responsive design
-Dark mode support
-Smooth navigation with sidebar views
-Onboarding screen for first-time users

# Data Handling

-Local storage persistence (no account required)
-Export data as JSON
-Import previously saved data
-Full data reset option

# Customization
Multiple currency options (USD, EUR, BDT, etc.)
Calendar-based month navigation
Tech Stack
HTML5
CSS3 (custom properties, responsive layout)
Vanilla JavaScript (no frameworks)
LocalStorage API for persistence

# Project Structure

index.html   # Entire application (UI + logic)
This is a single-file application where:
UI layout is written in HTML
Styling is handled with embedded CSS
Logic and state management are implemented in JavaScript

# How It Works
All data (transactions, budgets, settings) is stored locally in the browser.
The app dynamically updates UI components based on state changes.
No internet connection or backend is required after loading.

# Example state structure:
JSON
{
  "transactions": [],
  "budgets": [],
  "currency": "$"
}

# Getting Started

Download or clone the project
Open index.html in any modern browser
Start adding transactions using the + button
No installation or setup required.

# Key Components
Dashboard
Displays current balance, income, expenses
Monthly bar chart visualization
Top spending categories
Transactions
Full transaction list
Search and filter system
Income/expense classification
Budgets
Set limits per category
Track usage with progress bars

•Settings
-Currency selection
-Dark mode toggle
-Data import/export

# Limitations
No cloud sync (data is device-specific)
No authentication system
Not suitable for multi-user environments
Data can be lost if browser storage is cleared

# Future Improvements
Cloud sync / account system
Recurring transactions
Advanced analytics and reports
Mobile app version (React Native / Flutter)
Multi-currency conversion

# License
This project is open for personal and educational use.
