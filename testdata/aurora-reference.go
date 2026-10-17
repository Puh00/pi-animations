// Run from the pinned upstream checkout. Emits full glyph/FG/BG fixtures.
// Source commit: b2b26045b38aa4f59dd50781640cac65e9a291c1
// Command: go run ./cmd/aurora-fixture.go
package main

import (
  "encoding/json"
  "os"
  "github.com/cyperx84/ascii-animations/asciifx/fx"
  _ "github.com/cyperx84/ascii-animations/asciifx/effects"
)

type cell struct { Glyph string `json:"glyph"`; FG *[3]uint8 `json:"fg,omitempty"`; BG *[3]uint8 `json:"bg,omitempty"` }
type fixture struct { W int `json:"w"`; H int `json:"h"`; Seed uint64 `json:"seed"`; Tick int `json:"tick"`; Rows [][]cell `json:"rows"` }
func main() {
  var all []fixture
  for _, size := range [][2]int{{4,3},{40,8},{60,10}} {
    for _, seed := range []uint64{1,7,42} { for _, tick := range []int{0,30,90} {
      buf, _, err := fx.Render("aurora", fx.Options{W:size[0], H:size[1], Seed:seed}, tick); if err != nil { panic(err) }
      f:=fixture{W:size[0],H:size[1],Seed:seed,Tick:tick}
      for y:=0;y<size[1];y++ { row:=[]cell{}; for x:=0;x<size[0];x++ { c:=buf.Cells[y*size[0]+x]; z:=cell{Glyph:string(c.Rune)}; if c.FG.Valid {z.FG=&[3]uint8{c.FG.R,c.FG.G,c.FG.B}}; if c.BG.Valid {z.BG=&[3]uint8{c.BG.R,c.BG.G,c.BG.B}}; row=append(row,z) }; f.Rows=append(f.Rows,row) }
      all=append(all,f)
    }}
  }
  enc:=json.NewEncoder(os.Stdout); enc.SetIndent("","  "); if err:=enc.Encode(all);err!=nil{panic(err)}
}
