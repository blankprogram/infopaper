# Process Visualizer

This project is a process visualizer that displays a tree of parent-child processes and visualizes their CPU and memory usage. It looks like a sunflower because why not ?


![Sunflower Process Visualizer](flower.gif)


## Features

- Visualizes a tree of parent-child processes.
- Displays CPU and memory usage by most usage.
- Real-time updates.
- Interactive panning and zooming of the canvas.
- Visualises all cpu usage by update color of line.

## Getting Started

### Prerequisites

- A web server to host the project files.
- API endpoints providing process and system information:
  - `http://localhost:4444/process-info`
  - `http://localhost:4444/system-info`
- `config.json` file with the following structure:
```json
  {
    "apiKey": "your_api_key_here"
  }
```

### Installation
- <strong>Make sure both api keys match from the server and visualiser</strong>
1. Clone the repositories:
    ```console
    git clone git@github.com:blankprogram/infopaper.git
    git clone git@github.com:blankprogram/infoserver.git
    ```

    
1. Run the server:
    ```console
    cd infoserver
    python infoserver
    ```
3. Open the html file:
    ```console
    cd infopaper
    browsername index.html
    ```




