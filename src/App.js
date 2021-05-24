import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const EditorRef = useRef(null);
  const CodeRef = useRef(null);
  const ScreenRef = useRef(null);

  const [code, setCode] = useState("");

  useEffect(() => {
    if (EditorRef.current == null || ScreenRef.current == null) return;
    let Editor = EditorRef.current;
    Editor.innerText = code;
  }, [code]);

  useEffect(() => {
    if (EditorRef.current == null || ScreenRef.current == null) return;
    let Editor = EditorRef.current;
    let Screen = ScreenRef.current;
    let Code = CodeRef.current;
    Code.focus();
    Screen.innerText = "";

    /* ############ */

    class Basic {
      constructor(source) {
        this.tokens = [];
        this.lines = {};
        this.index = 0;
        this.editorLines = {};
        this.runnable = true;

        this.variables = {};
        try {
          this.tokenize(source);
        } catch (error) {
          this.runnable = false;
        }

        return;
      }

      tokenize(source) {
        if (!Array.isArray(source)) throw new Error("array expected");

        source.forEach((s, index) => {
          s.replace(/^\s*\d+/gm, (m) => {
            s = s.substring(m.length).trim();
            this.lines[m.trim()] = this.tokens.length;
          });

          s.replace(
            /\n\d+|\d+(\.\d*)?|\.\d+|REM.*$|\w+\$?|"[^"]*"|[-+*/():;=]|<[=>]?|>=?/gm,
            (m) => {
              this.tokens.push(/^REM/.test(m) ? "REM" : m);
            }
          );

          this.tokens.push(":EOL");
        });
      }

      next() {
        return this.tokens[this.index++];
      }

      back() {
        --this.index;
        return this;
      }

      at(token) {
        if (this.next() === token) {
          return true;
        }
        this.back();
      }

      expect(token) {
        this.at(token) ||
          this.error(`expected ${token} but found ${this.next()}`);
      }

      error(message) {
        Screen.innerHTML = message;
        throw new Error(message);
      }

      run() {
        while (this.runnable && true) {
          if (this.index === this.tokens.length) {
            console.log("finish");
            break;
          }
          try {
            this[this.next()].call(this);
          } catch (e) {
            console.log(
              "Error: ",
              e.message + " function: " + this.tokens[this.index - 1]
            );
            Screen.innerText = "";
            Screen.innerHTML += `<span style="color:red;">Error: ${
              e.message
            } function ${this.tokens[this.index - 1]}</span>`;

            let _t = Editor.innerText;

            console.table(this.tokens);
            console.table(this.lines);
            console.table(this.variables);
            console.table(this.editorLines);

            break;
          }
        }
      }

      LET() {
        this.next();
        this.assign();
      }

      REM() {
        this.expect(":EOL");
      }

      DIM() {
        const name = this.name();
        const size = this.evaluate();
        this.expect(":EOL");
        this.variables[name + "()"] = Array(size + 1);
      }

      CLEAR() {
        this.expect(":EOL");
        Screen.innerText = "";
      }

      PRINT() {
        function fmt(o) {
          return typeof o === "string" ? o : " " + o;
        }

        if (!this.atEnd()) {
          Screen.innerText += fmt(this.evaluate());
          while (this.at(";")) {
            if (this.atEnd()) {
              return;
            }
            Screen.innerText += fmt(this.evaluate());
          }
          this.expectEnd();
        }
        Screen.innerHTML += "<br>";
      }

      atEnd() {
        return this.at(":EOL");
      }

      expectEnd() {
        this.expect(":EOL");
      }

      assign() {
        let name = this.back().name();
        let index = this.at("(") ? this.back().evaluate() : null;
        this.expect("=");
        let value = this.evaluate();
        if (index !== null) {
          this.variables[name + "()"][index] = value;
        } else {
          this.variables[name] = value;
        }
        this.expectEnd();
      }

      name() {
        const token = this.next();
        if (/^[a-zA-Z]/.test(token)) {
          return token;
        }
        this.error(`expected name but found ${token}`);
      }

      evaluate() {
        let left = this.evalTerm();
        while (true) {
          if (this.at("+")) {
            left += this.evalTerm();
          } else if (this.at("-")) {
            left -= this.evalTerm();
          } else {
            return left;
          }
        }
      }

      evalTerm() {
        let left = this.evalFactor();
        while (true) {
          if (this.at("*")) {
            left *= this.evalFactor();
          } else if (this.at("/")) {
            left /= this.evalFactor();
          } else {
            return left;
          }
        }
      }

      evalFactor() {
        if (this.at("-")) {
          return -this.evalFactor();
        }
        if (this.at("(")) {
          const value = this.evaluate();
          this.expect(")");
          return value;
        }
        const token = this.next();
        if (/^"/.test(token)) {
          return token.substring(1, token.length - 1);
        }
        if (/^\d|^\./.test(token)) {
          return +token;
        }
        if (/^[a-zA-Z]/.test(token)) {
          if (token === "CHR$") {
            const value = this.evalFactor();
            return value === 12 ? "Console.clear" : String.fromCharCode(value);
          }
          if (token === "INT") {
            return Math.floor(this.evalFactor());
          }
          if (token === "RND") {
            this.evalFactor();
            return Math.random();
          }
          if (token === "TAB") {
            this.evalFactor();
            return "\t";
          }
          if (this.at("(")) {
            const index = this.back().evaluate();
            return this.variables[token + "()"][index] || 0;
          }
          return this.variables[token] || 0;
        }
        throw new Error("cannot evaluate " + token);
      }
    }

    /* ############ */

    const onKeyDown = (e) => {
      console.log(e);
      if (e.key === "Tab") {
        console.log("tab");
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      if (e.keyCode === 66 && e.ctrlKey) {
        let lines = Editor.innerText.trim().split("\n");
        console.log("RUN");
        let b = new Basic(lines);
        b.run();
        Screen.scrollTo(0, Screen.scrollHeight);
      }
    };

    Code.addEventListener("keyup", onKeyUp, false);
    Code.addEventListener("keydown", onKeyDown, false);

    Editor.addEventListener("mouseup", () => {
      Code.focus();
    });

    return () => {
      Editor.removeEventListener("keyup", onKeyUp, false);
    };
  }, []);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <div
        style={{
          flex: "1 1 0",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Roboto Mono', monospace",
          fontSize: 40,
          backgroundColor: "#00a2ed",
          color: "white",
          cursor: "default",
        }}
      >
        <div
          ref={EditorRef}
          style={{
            outline: "none",
            flex: "1 1 0",
            overflow: "auto",
            lineHeight: 1,
          }}
        ></div>
        <textarea
          style={{
            width: 1,
            height: 1,
            overflow: "hidden",
            backgroundColor: "transparent",
            color: "transparent",
            outline: "none",
            resize: "none",
            border: "none",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          ref={CodeRef}
          value={code}
          onChange={(e) => {
            console.log(e.target.value);
            setCode(e.target.value);
          }}
        />

        <div
          ref={ScreenRef}
          style={{
            maxHeight: "50%",
            overflow: "auto",
            backgroundColor: "black",
            position: "relative",
          }}
        ></div>
      </div>
    </div>
  );
}

export default App;
