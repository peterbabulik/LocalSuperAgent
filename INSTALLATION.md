# LocalSuperAgent Installation Guide

This guide provides detailed instructions for setting up LocalSuperAgent on different operating systems.

**Quick Links:**

*   [Linux Installation](#linux-installation)
*   [Windows Installation](#windows-installation)
*   [Android Installation (via Termux)](#android-installation-via-termux)


## System Requirements

**Node.js**: v18 or higher recommended.
**Git**: Required for cloning the repository.
**curl**: to download and install Ollama and Node.js.
**Ollama**: Installed locally (or accessible on the network) with an appropriate model downloaded, currently qwen3:1.7b)

## Linux Installation

These instructions are primarily for Debian/Ubuntu-based distributions. Adapt package manager commands (`apt`) for other distributions (e.g., `yum`, `dnf`, `pacman`).

**1. Install Prerequisites (Node.js & Git):**
   To install Node.js on a Debian-based Linux distribution, you can use the NodeSource repository. Here are the steps:

1. **Update your package index:**

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install the NodeSource PPA:**

   You can add the NodeSource repository to your system by running the following command. This example is for Node.js 14.x, but you can replace `14.x` with the version you want:

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
   ```

3. **Install Node.js:**

   After adding the repository, you can install Node.js by running:

   ```bash
   sudo apt install -y nodejs
   ```

4. **Verify the installation:**

   You can verify that Node.js is installed correctly by checking the version:

   ```bash
   node -v
   ```

   And for npm (Node Package Manager):

   ```bash
   npm -v
   ```

**2. Install Ollama & Download Model:**
   1.  **Install and run Ollama:** 
    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ```
   2.  **run Ollama:** in new terminal window
    ```bash
    ollama serve 
    ```

   3.  **Pull an AI Model:** in new terminal window, download the model you intend to use (the default is `qwen3:1.7b`, adjust `config.js` or environment variables if using a different one).
    ```bash
    ollama pull qwen3:1.7b
    ```

**3. Clone the Repository:**
   ```bash
   git clone https://github.com/peterbabulik/LocalSuperAgent.git
   cd LocalSuperAgent
   ```

**4. Install Project Dependencies:**
   Inside the `LocalSuperAgent` directory, run:
   ```bash
   npm install
   ```

**5. Run the Application:**
   ```bash
   node index.js
   ```


## Windows Installation

**1. Install Prerequisites (Node.js & Git):**
   1.  **Install Git:** Download and install Git for Windows from [git-scm.com](https://git-scm.com/download/win). Using Git Bash (included) is recommended for the command line.
   2.  **Install Node.js:** Download and run the LTS installer from the official [Node.js website](https://nodejs.org/).
   3.  **Verify Installations:** Open Git Bash or Command Prompt and run:
       ```bash
       git --version
       node -v
       npm -v
       ```

**2. Install Ollama & Download Model:**
   1.  **Install Ollama:** Follow the Windows instructions at [Ollama's official website](https://ollama.com/).
   2.  **Pull an AI Model:** in new terminal window, download the model you intend to use (the default is `qwen3:1.7b`, adjust `config.js` or environment variables if using a different one).
    ```bash
    ollama pull qwen3:1.7b
    ```
    
**3. Clone the Repository:**
   Open Git Bash or Command Prompt and run:
   ```bash
   git clone https://github.com/peterbabulik/LocalSuperAgent.git
   cd LocalSuperAgent
   ```

**4. Install Project Dependencies:**
   Inside the `LocalSuperAgent` directory, run:
   ```bash
   npm install
   ```

**5. Run the Application:**
   ```bash
   node index.js
   ```

## Android Installation (via Termux)

1.  **Install Termux:** Download and install Termux from the Google Play Store: [https://play.google.com/store/apps/details?id=com.termux](https://play.google.com/store/apps/details?id=com.termux)

2.  **Update and Upgrade Termux:** Open Termux and run the following command:

    ```bash
    apt update && apt upgrade -y
    ```

3.  **Install proot-distro:** Run the following command:

    ```bash
    apt install proot-distro
    ```

4.  **Login to Ubuntu:** Run the following command:

    ```bash
    proot-distro login ubuntu
    ```

    **And now you feel like a real hacker ;)**

5.  **Update and Upgrade Ubuntu (inside proot):**  After logging into Ubuntu, run:

    ```bash
    apt update && apt upgrade -y
    ```

6.  **Install Ollama:** First, install `curl`:

    ```bash
    apt install curl
    ```

    Then, install Ollama using the following command:

    ```bash
    curl -fsSL https://ollama.com/install.sh | sh
    ```

7.  **Start Ollama and Run qweng3:1.7b:**  Open *three* Termux terminal windows. (Swipe from the left edge of the screen in Termux and click the "+" icon to create new terminals.)

    *   **Terminal 1:** Run:

        ```bash
        proot-distro login ubuntu
        ```
        ```bash
        ollama serve
        ```

    *   **Terminal 2:** Run:

        ```bash
        proot-distro login ubuntu
        ```
        ```bash
        ollama run qwen3:1.7b
        ```

        Qwen will be downloaded and started. This may take a while. You can interact with qwen directly in this terminal (talk with it).

    
8. **In Terminal 3 (or any new terminal after starting `ollama serve` and `ollama run qwen3:1.7b` is running)**
```bash
git clone https://github.com/peterbabulik/LocalSuperAgent.git
cd LocalSuperAgent
```

9. **Install Project Dependencies**

Inside the `LocalSuperAgent` directory, run:
```bash
npm install
```

10. **Usage**

Start the application:

```bash
node index.js
```

The system will prompt you to enter a project goal. Based on this goal, the SuperAgent will plan and execute tasks, potentially delegating specific work to specialized executors.

## Configuration Options

The system can be configured through the `config.js` file and environment variables.

## Disclaimer

This guide is provided for informational purposes only. Running AI models on mobile devices can be resource-intensive and may impact battery life and performance. Use at your own risk.