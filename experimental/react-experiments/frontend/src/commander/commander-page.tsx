import React, { useCallback, useEffect } from 'react';
import "./commander.css";

type CommandDefinition = {
  id: string;
  name: string;
  description: string;
};

const useCommands = () => {
  const [commands, setCommands] = React.useState<CommandDefinition[]>([]);
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await fetch('/api/commander/commands');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setCommands(data.commands);
      } catch (error) {
        console.error('Error fetching commands:', error);
      }
    };

    fetchCommands();
  }, []);

  const runCommand = useCallback(async (commandId: string) => {
    try {
      const response = await fetch(`/api/commander/run/${commandId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log('Command result:', data);
    } catch (error) {
      console.error('Error running command:', error);
    }
  }, [commands]);

  return {
    commands,
    runCommand,
  };
};

export const CommanderPage = () => {
  const { commands, runCommand } = useCommands();

  return (
    <div>
      <h1>Commander</h1>
      <div>
        <h2>Commands</h2>
        <ul>
          {commands.map((command) => (
            <li key={command.id}>
              <span
                className="commander-button"
                onClick={() => runCommand(command.id)}
              >
                {command.name}
              </span>: {command.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}