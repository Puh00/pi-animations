// Append to src/main.rs in a checkout of termflix revision
// f2f2a3abe818bc0f85986c66de5750ef13cd1e59, then run:
// cargo test --release --locked --bin termflix emit_upstream_ocean_frames -- --nocapture
#[cfg(test)]
mod ocean_reference_fixture {
    use super::{animations, render::{Canvas, ColorMode, RenderMode}};
    use serde_json::{json, Value};

    #[test]
    fn emit_upstream_ocean_frames() {
        let mut cases = Vec::<Value>::new();
        for (width, height, seconds) in [(12usize, 3usize, 0.0f64), (40, 8, 0.0), (40, 5, 0.5), (24, 10, 1.25)] {
            let mut ocean = animations::create("ocean", width, height, 1.0).unwrap();
            let mut color = Canvas::new(width, height, RenderMode::HalfBlock, ColorMode::TrueColor);
            color.clear();
            ocean.update(&mut color, 1.0 / 24.0, seconds);
            let color_grid = color.build_grid();
            let mut mono = Canvas::new(width, height, RenderMode::HalfBlock, ColorMode::Mono);
            mono.clear();
            ocean.update(&mut mono, 1.0 / 24.0, seconds);
            let mono_grid = mono.build_grid();
            let rows = (0..color_grid.rows).map(|y| {
                let mut glyphs = String::new();
                let mut monochrome = String::new();
                let mut fg = Vec::<Option<Value>>::new();
                let mut bg = Vec::<Option<Value>>::new();
                for x in 0..color_grid.cols {
                    let cell = color_grid.get(y, x);
                    glyphs.push(cell.ch);
                    monochrome.push(mono_grid.get(y, x).ch);
                    let rgb = |color: Option<crossterm::style::Color>| match color {
                        Some(crossterm::style::Color::Rgb { r, g, b }) => Some(json!([r, g, b])),
                        None => None,
                        other => panic!("unexpected color: {other:?}"),
                    };
                    fg.push(rgb(cell.fg));
                    bg.push(rgb(cell.bg));
                }
                json!({"glyphs": glyphs, "fg": fg, "bg": bg, "mono": monochrome})
            }).collect::<Vec<_>>();
            cases.push(json!({"width": width, "height": height, "seconds": seconds, "rows": rows}));
        }
        let fixture = json!({
            "source": "termflix Rust implementation at pinned revision, direct Canvas HalfBlock truecolor and mono grids",
            "revision": "f2f2a3abe818bc0f85986c66de5750ef13cd1e59",
            "cases": cases
        });
        println!("{}", serde_json::to_string_pretty(&fixture).unwrap());
    }
}
